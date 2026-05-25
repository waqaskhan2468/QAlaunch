import type { Browser, Page } from 'playwright-core';
import type { IncrementalArtifactWriter } from '@/lib/artifacts/incremental';
import { responsiveToArtifactMeta } from '@/lib/artifacts/serialize';
import type { BrowserbaseSession } from '@/lib/scan/browser';
import {
	closeBrowserSession,
	connectBrowserbase,
	createBrowserbaseSession,
} from '@/lib/scan/browser';
import type { ScanResult, ScanStep } from '../types/scan.types';
import { collectAxeViolations } from './accessibility';
import { attachPageDiagnostics } from './diagnostics';
import {
	cleanError,
	closeContext,
	getNavTimeoutMs,
	navigatePage,
	runStep,
} from './navigation';
import { collectInteractiveData, collectSeoData } from './seo';
import { collectLinks } from './links';
import {
	captureResponsiveFromPage,
	startMobileNavigation,
} from './responsive';
import { blockThirdPartyResources } from './resourceBlocklist';
import { withRetry } from './retry';
import { captureDesktopScreenshot } from './screenshots';
import { collectBrokenStates } from './brokenStates';

const DEFAULT_PAGE_SCAN_TIMEOUT_MS = 180_000;

const PAGE_DEFAULT_TIMEOUT_MS = 30_000;

/** Non-critical collectors (links, seo, interactive, broken_states): single attempt. */
const COLLECTOR_RETRY = { attempts: 1, delayMs: 1_000 } as const;

/** Critical paths: keep 2 attempts. */
const AXE_RETRY = { attempts: 2, delayMs: 1_000 } as const;
const AXE_RETRY_SLOW = { attempts: 2, delayMs: 1_500 } as const;
const SCREENSHOT_RETRY = { attempts: 2, delayMs: 1_000 } as const;
const RESPONSIVE_RETRY = { attempts: 2, delayMs: 1_000 } as const;

/** Hard ceiling for one Browserbase pass (navigate + collectors + screenshots). */
export function getPageScanTimeoutMs(): number {
	const raw = Number.parseInt(process.env.SCAN_PAGE_TIMEOUT_MS ?? '', 10);
	return Number.isFinite(raw) && raw >= 60_000 ?
			raw
		:	DEFAULT_PAGE_SCAN_TIMEOUT_MS;
}

function withPageTimeout<T>(
	promise: Promise<T>,
	url: string,
	scanId: string,
	onTimeout?: () => void,
): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;

	const timeoutPromise = new Promise<T>((_, reject) => {
		timer = setTimeout(() => {
			onTimeout?.();
			reject(
				new Error(
					`[scan] page timeout after ${getPageScanTimeoutMs()}ms: ${url} (scanId=${scanId})`,
				),
			);
		}, getPageScanTimeoutMs());
	});

	return Promise.race([
		promise.finally(() => {
			if (timer) clearTimeout(timer);
		}),
		timeoutPromise,
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
			(step) => (step.name === 'axe' || step.name === 'axe_retry') && step.ok,
		) && Array.isArray(result.axe)
	);
}

async function retryAxeOnSamePage(
	page: Page,
	result: ScanResult,
	writer?: IncrementalArtifactWriter,
): Promise<void> {
	if (!hasSuccessfulNavigation(result.steps) || hasSuccessfulAxe(result)) {
		return;
	}

	const axeRetry = await runStep(result.steps, 'axe_retry', () =>
		withRetry(() => collectAxeViolations(page), AXE_RETRY_SLOW),
	);

	if (axeRetry !== undefined) {
		result.axe = axeRetry;
		result.warnings.push('Retried accessibility scan on the same page.');
		await writer?.flushSlice('accessibility', axeRetry);
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

function hardenPage(page: Page): void {
	const navTimeout = getNavTimeoutMs();
	page.setDefaultTimeout(PAGE_DEFAULT_TIMEOUT_MS);
	page.setDefaultNavigationTimeout(navTimeout);
}

type MobileNavResult = Awaited<ReturnType<typeof startMobileNavigation>>;

async function captureMobileFromNavigation(
	mobileNav: MobileNavResult | null,
	result: ScanResult,
	writer?: IncrementalArtifactWriter,
): Promise<Buffer | undefined> {
	if (!mobileNav) {
		result.warnings.push(
			'mobile_navigation_failed: mobile screenshot unavailable',
		);
		result.steps.push({
			name: 'responsive',
			ok: false,
			error: 'mobile_background_navigation_failed',
		});
		return undefined;
	}

	const mobilePage = mobileNav.page;
	const mobileContext = mobilePage.context();

	try {
		const responsiveResult = await runStep(result.steps, 'responsive', () =>
			withRetry(
				() => captureResponsiveFromPage(mobilePage, mobileNav.viewport),
				RESPONSIVE_RETRY,
			),
		);

		if (responsiveResult) {
			result.responsive = [responsiveResult];
			const meta = responsiveToArtifactMeta([responsiveResult]);
			await writer?.flushSlice('responsive', meta);
			return responsiveResult.screenshot;
		}
	} finally {
		await closeContext(mobileContext);
	}

	return undefined;
}

async function scanSingleUrl(
	browser: Browser,
	url: string,
	scanId: string,
	writer?: IncrementalArtifactWriter,
	registerAbort?: (abort: () => Promise<void>) => void,
): Promise<ScanResult> {
	const context = await browser.newContext();
	const result = createEmptyScanResult(scanId, url);

	registerAbort?.(() => closeContext(context));

	try {
		const page = await context.newPage();

		hardenPage(page);
		await blockThirdPartyResources(page);

		attachPageDiagnostics(page, result);

		await navigatePage(page, url, result);

		// Start mobile only after desktop navigation succeeds (avoids ~30s dead nav
		// running in parallel when the desktop page never loads).
		const mobileNavigationPromise = startMobileNavigation(browser, url).catch(
			(err) => {
				console.warn('[scan] mobile navigation background start failed', {
					url,
					scanId,
					error: err instanceof Error ? err.message : String(err),
				});
				return null;
			},
		);

		if (result.responseSecurityMeta) {
			await writer?.flushSlice(
				'response_security',
				result.responseSecurityMeta,
			);
		}

		// ── Parallel collection (Promise.allSettled) ────────────────────────
		// All seven tasks are fully independent — none needs another's output.
		// Promise.allSettled is used instead of Promise.all so that even if any
		// task rejects unexpectedly (bypassing runStep's internal guard), every
		// other collector still runs to completion and its result is preserved.
		//
		// Screenshots and axe run concurrently: axe can take 60-90 s on heavy
		// pages; blocking screenshots until axe finishes would risk the 120 s
		// page-timeout firing before any image is saved.
		function settled<T>(r: PromiseSettledResult<T>): T | undefined {
			return r.status === 'fulfilled' ? r.value : undefined;
		}

		const [
			r_brokenStates,
			r_links,
			r_interactive,
			r_seoData,
			r_axe,
			r_desktopScreenshot,
			r_mobileScreenshot,
		] = await Promise.allSettled([
			runStep(result.steps, 'broken_states', async () => {
				const data = await withRetry(
					() => collectBrokenStates(page),
					COLLECTOR_RETRY,
				);
				await writer?.flushSlice('broken_states', data);
				return data;
			}),
			runStep(result.steps, 'links', async () => {
				const data = await withRetry(
					() => collectLinks(page, url),
					COLLECTOR_RETRY,
				);
				await writer?.flushSlice('links', data);
				return data;
			}),
			runStep(result.steps, 'interactive', async () => {
				const data = await withRetry(
					() => collectInteractiveData(page),
					COLLECTOR_RETRY,
				);
				await writer?.flushSlice('interactive', data);
				return data;
			}),
			runStep(result.steps, 'seo', async () => {
				const data = await withRetry(
					() => collectSeoData(page),
					COLLECTOR_RETRY,
				);
				await writer?.flushSlice('seo', data);
				return data;
			}),
			runStep(result.steps, 'axe', async () => {
				const data = await withRetry(
					() => collectAxeViolations(page),
					AXE_RETRY,
				);
				await writer?.flushSlice('accessibility', data);
				return data;
			}),
			// Desktop screenshot runs in parallel with all collectors above.
			runStep(result.steps, 'screenshot:desktop', () =>
				withRetry(() => captureDesktopScreenshot(page), SCREENSHOT_RETRY),
			),
			// Mobile screenshot: navigation started in the background above;
			// capture runs parallel with the desktop screenshot and collectors.
			mobileNavigationPromise.then((mobileNav) =>
				captureMobileFromNavigation(mobileNav, result, writer),
			),
		]);

		const brokenStates = settled(r_brokenStates);
		const links = settled(r_links);
		const interactive = settled(r_interactive);
		const seoData = settled(r_seoData);
		const axe = settled(r_axe);
		const desktopScreenshot = settled(r_desktopScreenshot);
		const mobileScreenshot = settled(r_mobileScreenshot);

		result.brokenStates = brokenStates;
		result.links = links;
		result.interactive = interactive;
		result.seoData = seoData;
		result.axe = axe;

		await retryAxeOnSamePage(page, result, writer);

		result.screenshots = {};

		console.log('[scan] desktop screenshot:', {
			captured: !!desktopScreenshot,
			size: desktopScreenshot?.length,
		});

		if (desktopScreenshot) {
			result.screenshots.desktop = desktopScreenshot;
			await writer?.uploadScreenshot('desktop', desktopScreenshot);
		}

		if (mobileScreenshot) {
			result.screenshots.mobile = mobileScreenshot;
			await writer?.uploadScreenshot('mobile', mobileScreenshot);
		}

		const navigationOk = hasSuccessfulNavigation(result.steps);
		const axeOk = hasSuccessfulAxe(result);
		const hasCoreCapture =
			Boolean(result.screenshots?.desktop) &&
			Boolean(result.screenshots?.mobile);

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
	writer?: IncrementalArtifactWriter,
): Promise<ScanResult> {
	let abortScan: (() => Promise<void>) | null = null;

	const result = await withPageTimeout(
		scanSingleUrl(browser, url, scanId, writer, (abort) => {
			abortScan = abort;
		}),
		url,
		scanId,
		() => {
			void abortScan?.();
		},
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

/**
 * Scan one page on an existing Browserbase session (shared across pages).
 * Does not close the remote browser — caller closes after all pages.
 */
export async function runPlaywrightScanOnSession(
	connectUrl: string,
	scanId: string,
	url: string,
	options?: { writer?: IncrementalArtifactWriter },
): Promise<ScanResult> {
	const browser = await connectBrowserbase(connectUrl);
	try {
		return await scanSingleUrlWithTimeout(
			browser,
			url,
			scanId,
			options?.writer,
		);
	} finally {
		// Contexts are closed inside scanSingleUrl; leave remote browser alive for other pages.
	}
}

/** One Browserbase session per page (legacy / single-page fallback). */
export async function runPlaywrightScanForUrl(
	scanId: string,
	pageUrl: string,
	options?: { writer?: IncrementalArtifactWriter },
): Promise<ScanResult> {
	const session: BrowserbaseSession = await createBrowserbaseSession(
		scanId,
		pageUrl,
	);
	const browser = await connectBrowserbase(session.connectUrl);
	try {
		return await scanSingleUrlWithTimeout(
			browser,
			pageUrl,
			scanId,
			options?.writer,
		);
	} finally {
		await closeBrowserSession(browser);
	}
}