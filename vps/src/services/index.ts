import { chromium, type Browser } from 'playwright';
import type { ScanResult, ScanStep } from '../types/scan.types';
import { collectAxeViolations } from './accessibility';
import { attachPageDiagnostics } from './diagnostics';
import { cleanError, closeContext, navigatePage, runStep } from './navigation';
import { collectInteractiveData, collectSeoData } from './seo';
import { collectLinks } from './links';
import { collectResponsive, MOBILE_VIEWPORT_NAME } from './responsive';
import { withRetry } from './retry';
import { captureDesktopScreenshot } from './screenshots';
import { RAW_HTML_MAX_BYTES, truncateUtf8Bytes } from '../utils/html';

const DEFAULT_PAGE_CONCURRENCY = 1;
const PAGE_SCAN_ATTEMPTS = 2;

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
		result.steps.some((step) => step.name === 'axe' && step.ok) &&
		Array.isArray(result.axe)
	);
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

function getPageConcurrency(urlCount: number): number {
	const configured = Number.parseInt(
		process.env.SCAN_PAGE_CONCURRENCY ?? `${DEFAULT_PAGE_CONCURRENCY}`,
		10,
	);
	const safeConfigured =
		Number.isFinite(configured) && configured > 0 ?
			configured
		:	DEFAULT_PAGE_CONCURRENCY;

	return Math.max(1, Math.min(safeConfigured, urlCount));
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

		result.screenshots = {};

		const desktopScreenshot = await runStep(
			result.steps,
			'screenshot:desktop',
			() =>
				withRetry(() => captureDesktopScreenshot(page), {
					attempts: 2,
					delayMs: 1_000,
				}),
		);

		console.log('[scan] desktop screenshot:', {
			captured: !!desktopScreenshot,
			size: desktopScreenshot?.length,
		});

		if (desktopScreenshot) {
			result.screenshots.desktop = desktopScreenshot;
		}

		const [links, interactive, seoData, axe] = await Promise.all([
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

		result.links = links;
		result.interactive = interactive;
		result.seoData = seoData;
		result.axe = axe;

		const responsive = await runStep(result.steps, 'responsive', () =>
			withRetry(() => collectResponsive(browser, url), {
				attempts: 2,
				delayMs: 1_000,
			}),
		);

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

		result.ok = navigationOk && axeOk;

		if (navigationOk && !axeOk) {
			result.error = `accessibility_gate_fail: ${getAxeFailureReason(result)}`;
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

async function scanSingleUrlWithRetry(
	browser: Browser,
	url: string,
	scanId: string,
): Promise<ScanResult> {
	let result = await scanSingleUrl(browser, url, scanId);
	let missingData = getMissingScanData(result);

	for (
		let attempt = 2;
		attempt <= PAGE_SCAN_ATTEMPTS && missingData.length > 0;
		attempt += 1
	) {
		const retryResult = await scanSingleUrl(browser, url, scanId);
		retryResult.warnings.unshift(
			`Retried page scan after incomplete attempt: ${missingData.join(', ')}`,
		);

		result = retryResult;
		missingData = getMissingScanData(result);
	}

	if (missingData.length > 0) {
		result.warnings.push(`Missing scan data: ${missingData.join(', ')}`);
	}

	return result;
}

export async function runPlaywrightScan(
	urls: string[],
	scanId: string,
): Promise<ScanResult[]> {
	const browser = await chromium.launch({ headless: true });

	try {
		const results: ScanResult[] = [];
		const concurrency = getPageConcurrency(urls.length);

		for (let index = 0; index < urls.length; index += concurrency) {
			const chunk = urls.slice(index, index + concurrency);
			const chunkResults = await Promise.all(
				chunk.map((url) => scanSingleUrlWithRetry(browser, url, scanId)),
			);

			results.push(...chunkResults);
		}
		
		return results;
	} finally {
		await browser.close();
	}
}
