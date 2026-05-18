import type { Browser, Page } from 'playwright-core';
import {
	closeBrowserSession,
	connectBrowserbase,
	createBrowserbaseSession,
} from '../browser';
import type { ScanResult, ScanStep } from '../types/scan.types';
import { collectAxeViolations } from './accessibility';
import { attachPageDiagnostics } from './diagnostics';
import { cleanError, closeContext, navigatePage, runStep } from './navigation';
import { collectInteractiveData, collectSeoData } from './seo';
import { collectLinks } from './links';
import { collectResponsive, MOBILE_VIEWPORT_NAME } from './responsive';
import { withRetry } from './retry';
import { captureDesktopScreenshot } from './screenshots';
import { collectBrokenStates } from './brokenStates';
import { RAW_HTML_MAX_BYTES, truncateUtf8Bytes } from '../utils/html';

const DEFAULT_PAGE_SCAN_TIMEOUT_MS = 120_000;

/** Hard ceiling for one Browserbase pass (navigate + collectors + screenshots). */
export function getPageScanTimeoutMs(): number {
	const raw = Number.parseInt(process.env.SCAN_PAGE_TIMEOUT_MS ?? '', 10);
	return Number.isFinite(raw) && raw >= 60_000 ? raw : DEFAULT_PAGE_SCAN_TIMEOUT_MS;
}

function withPageTimeout<T>(
	promise: Promise<T>,
	url: string,
	scanId: string,
): Promise<T> {
	return Promise.race([
		promise,
		new Promise<T>((_, reject) =>
			setTimeout(
				() =>
					reject(
						new Error(
							`[scan] page timeout after ${getPageScanTimeoutMs()}ms: ${url} (scanId=${scanId})`,
						),
					),
				getPageScanTimeoutMs(),
			),
		),
	]);
}

function createEmptyScanResult(scanId: string, url: string): ScanResult {
	return {
		scanId,
		url,
		ok: false,
		warnings: [],
		steps: [],
		consoleMessages: [],
		failedRequests: [],
		httpErrors: [],
	};
}


function hasSuccessfulNavigation(steps: ScanStep[]): boolean {
	return steps.some((step) => step.name.startsWith('navigate') && step.ok);
}

function hasSuccessfulAxe(result: ScanResult): boolean {
	return (
		result.steps.some(
			(step) =>
				(step.name === 'axe' || step.name === 'axe_retry') && step.ok,
		) && Array.isArray(result.axe)
	);
}

async function retryAxeOnSamePage(page: Page, result: ScanResult): Promise<void> {
	if (!hasSuccessfulNavigation(result.steps) || hasSuccessfulAxe(result)) {
		return;
	}

	const axeRetry = await runStep(result.steps, 'axe_retry', () =>
		withRetry(() => collectAxeViolations(page), {
			attempts: 2,
			delayMs: 1_500,
		}),
	);

	if (axeRetry !== undefined) {
		result.axe = axeRetry;
		result.warnings.push('Retried accessibility scan on the same page.');
	}
}

function getAxeFailureReason(result: ScanResult): string {
	const axeStep = result.steps.find((step) => step.name === 'axe');

	if (!axeStep) return 'axe_step_missing';
	if (!axeStep.ok) return axeStep.error ?? 'axe_step_failed';
	if (!Array.isArray(result.axe)) return 'axe_result_missing';

	return 'axe_unknown_failure';
}

function getMissingScanData(result: ScanResult): string[] {
	const missing: string[] = [];

	if (!hasSuccessfulNavigation(result.steps)) missing.push('navigation');
	if (!result.links) missing.push('links');
	if (!result.interactive) missing.push('interactive');
	if (!result.seoData) missing.push('seo');
	if (!result.axe) missing.push('axe');
	if (!result.responsive?.length) missing.push('responsive');
	if (!result.screenshots?.desktop) missing.push('desktop_screenshot');
	if (!result.screenshots?.mobile) missing.push('mobile_screenshot');

	return missing;
}

async function scanSingleUrl(
	browser: Browser,
	url: string,
	scanId: string,
): Promise<ScanResult> {
	const context = await browser.newContext();
	const result = createEmptyScanResult(scanId, url);

	try {
		const page = await context.newPage();
		attachPageDiagnostics(page, result);

		await navigatePage(page, url, result);

		// Serialized DOM for scan_pages.raw_html (UTF-8 capped in utils/html).
		const rawHtml = await runStep(result.steps, 'raw_html', async () => {
			const html = await page.content();
			return truncateUtf8Bytes(html, RAW_HTML_MAX_BYTES);
		});

		if (rawHtml !== undefined) {
			result.rawHtml = rawHtml;
		}

		const [brokenStates, links, interactive, seoData, axe] = await Promise.all([
				runStep(result.steps, 'broken_states', () =>
					withRetry(() => collectBrokenStates(page), {
						attempts: 2,
						delayMs: 500,
					}),
				),
				runStep(result.steps, 'links', () =>
					withRetry(() => collectLinks(page, url), {
						attempts: 2,
						delayMs: 1_000,
					}),
				),
				runStep(result.steps, 'interactive', () =>
					withRetry(() => collectInteractiveData(page), {
						attempts: 2,
						delayMs: 1_000,
					}),
				),
				runStep(result.steps, 'seo', () =>
					withRetry(() => collectSeoData(page), {
						attempts: 2,
						delayMs: 1_000,
					}),
				),
				runStep(result.steps, 'axe', () =>
					withRetry(() => collectAxeViolations(page), {
						attempts: 2,
						delayMs: 1_000,
					}),
				),
			]);

		result.brokenStates = brokenStates;
		result.links = links;
		result.interactive = interactive;
		result.seoData = seoData;
		result.axe = axe;

		await retryAxeOnSamePage(page, result);

		result.screenshots = {};

		// Desktop screenshot (on existing page) and responsive capture (new context)
		// are independent — run them in parallel to hide each other's wait time.
		const [desktopScreenshot, responsive] = await Promise.all([
			runStep(result.steps, 'screenshot:desktop', () =>
				withRetry(() => captureDesktopScreenshot(page), {
					attempts: 2,
					delayMs: 1_000,
				}),
			),
			runStep(result.steps, 'responsive', () =>
				withRetry(() => collectResponsive(browser, url), {
					attempts: 2,
					delayMs: 1_000,
				}),
			),
		]);

		console.log('[scan] desktop screenshot:', {
			captured: !!desktopScreenshot,
			size: desktopScreenshot?.length,
		});

		if (desktopScreenshot) {
			result.screenshots.desktop = desktopScreenshot;
		}

		result.responsive = responsive;

		const mobileScreenshot = await runStep(
			result.steps,
			'screenshot:mobile',
			async () => {
				const mobileViewport = responsive?.find(
					(item) => item.viewport === MOBILE_VIEWPORT_NAME,
				);

				if (!mobileViewport) {
					throw new Error(`${MOBILE_VIEWPORT_NAME} screenshot missing`);
				}

				return mobileViewport.screenshot;
			},
		);

		if (mobileScreenshot) {
			result.screenshots.mobile = mobileScreenshot;
		}

		const navigationOk = hasSuccessfulNavigation(result.steps);
		const axeOk = hasSuccessfulAxe(result);
		const hasCoreCapture =
			Boolean(result.screenshots?.desktop) && Boolean(result.screenshots?.mobile);

		// Axe can fail when Next bundles axe-core incorrectly; still proceed if we have
		// navigation + screenshots so AI and the report can run (axe stored when present).
		result.ok = navigationOk && (axeOk || hasCoreCapture);

		if (navigationOk && !axeOk) {
			const axeReason = getAxeFailureReason(result);
			result.warnings.push(
				`Accessibility scan incomplete (${axeReason}). Other checks and screenshots were captured.`,
			);
			if (!hasCoreCapture) {
				result.error = `accessibility_gate_fail: ${axeReason}`;
			}
		}

		return result;
	} catch (error) {
		result.ok = false;
		result.error = cleanError(error);
		return result;
	} finally {
		await closeContext(context);
	}
}

async function scanSingleUrlWithTimeout(
	browser: Browser,
	url: string,
	scanId: string,
): Promise<ScanResult> {
	const result = await withPageTimeout(
		scanSingleUrl(browser, url, scanId),
		url,
		scanId,
	);

	const missingData = getMissingScanData(result);
	if (missingData.length > 0) {
		console.log('[scan] incomplete page data:', {
			url,
			missingData,
			ok: result.ok,
		});
		result.warnings.push(`Missing scan data: ${missingData.join(', ')}`);
	}

	return result;
}

/** One Browserbase session per page — fits Vercel/Inngest step timeouts. */
export async function runPlaywrightScanForUrl(
	scanId: string,
	url: string,
): Promise<ScanResult> {
	const session = await createBrowserbaseSession(scanId, url);
	const browser = await connectBrowserbase(session.connectUrl);

	try {
		return await scanSingleUrlWithTimeout(browser, url, scanId);
	} finally {
		await closeBrowserSession(browser);
	}
}
