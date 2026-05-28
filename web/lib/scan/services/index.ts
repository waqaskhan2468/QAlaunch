import type { Browser, BrowserContext, Page } from 'playwright-core';
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
import { captureResponsiveFromPage, startMobileNavigation } from './responsive';
import { blockThirdPartyResources } from './resourceBlocklist';
import { captureDesktopScreenshot } from './screenshots';
import { collectBrokenStates } from './brokenStates';

// Raised from 180 s → 240 s. The 180 s budget was too tight once Phase 1
// collectors (link HTTP-checks + axe) were run sequentially before screenshots.
// Browserbase session timeout is set to 300 s in browser.ts, so 240 s leaves
// a comfortable 60 s safety margin.
const DEFAULT_PAGE_SCAN_TIMEOUT_MS = 240_000;

// Hard Node.js-level ceiling for Phase 2 (mobile nav + screenshot).
// Playwright's own timeout is a CDP message — when Browserbase is congested
// that message never arrives and page.screenshot() hangs indefinitely.
// This setTimeout fires regardless of CDP state and force-closes the mobile
// context, unblocking any stuck Playwright call.
// Reduced from 55 s → 30 s: mobile nav takes ~15 s on a fast site + ~3 s screenshot
// = ~18 s total. 30 s gives a 12 s safety margin while saving up to 25 s on slow
// sites where mobile nav stalls, keeping the total scan within ~1 minute.
const MOBILE_PHASE_TIMEOUT_MS = 30_000;

// Reduce from 10 s → 8 s. Individual page.evaluate() / waitFor* calls on
// a live page rarely need more than a few seconds. The outer page-scan timeout
// is the real ceiling; a per-operation ceiling prevents frozen collectors from
// consuming the entire budget before failing.
const PAGE_DEFAULT_TIMEOUT_MS = 8_000;

const DESKTOP_VIEWPORT = { width: 1440, height: 900 };

// Read once at module load so the env var is not re-parsed on every scan call.
const PAGE_SCAN_TIMEOUT_MS = (() => {
	const raw = Number.parseInt(process.env.SCAN_PAGE_TIMEOUT_MS ?? '', 10);
	return Number.isFinite(raw) && raw >= 60_000 ?
			raw
		:	DEFAULT_PAGE_SCAN_TIMEOUT_MS;
})();

function settled<T>(r: PromiseSettledResult<T>): T | undefined {
	return r.status === 'fulfilled' ? r.value : undefined;
}

/** Hard ceiling for one Browserbase pass (navigate + collectors + screenshots). */
export function getPageScanTimeoutMs(): number {
	return PAGE_SCAN_TIMEOUT_MS;
}

function withPageTimeout<T>(
	promise: Promise<T>,
	url: string,
	scanId: string,
	onTimeout?: () => void,
): Promise<T> {
	const timeoutMs = PAGE_SCAN_TIMEOUT_MS;
	let timer: ReturnType<typeof setTimeout> | undefined;

	const timeoutPromise = new Promise<T>((_, reject) => {
		timer = setTimeout(() => {
			onTimeout?.();
			reject(
				new Error(
					`[scan] page timeout after ${timeoutMs}ms: ${url} (scanId=${scanId})`,
				),
			);
		}, timeoutMs);
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
			captureResponsiveFromPage(mobilePage, mobileNav.viewport),
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
	const context = await browser.newContext({ viewport: DESKTOP_VIEWPORT });
	const result = createEmptyScanResult(scanId, url);

	registerAbort?.(() => closeContext(context));

	try {
		const page = await context.newPage();

		hardenPage(page);
		await blockThirdPartyResources(page);

		attachPageDiagnostics(page, result);

		await navigatePage(page, url, result);

		if (result.responseSecurityMeta) {
			await writer?.flushSlice(
				'response_security',
				result.responseSecurityMeta,
			);
		}

		// Flush a diagnostics snapshot right after navigation settles so
		// finalizePartial() has real data if a later collector timeout fires.
		await writer?.flushSlice('diagnostics', {
			consoleMessages: result.consoleMessages,
			failedRequests: result.failedRequests,
			httpErrors: result.httpErrors,
		});

		// ── Desktop screenshot — BEFORE collectors start ───────────────────────
		// Captured immediately while the page is fresh and the CDP connection is
		// uncontested (fast mode = ~200 ms prep + screenshot).  Stored on result
		// immediately; upload runs concurrently with Phase 1 (see below) so it
		// never adds to the critical path.
		result.screenshots = {};
		const earlyDesktop = await runStep(result.steps, 'screenshot:desktop', () =>
			captureDesktopScreenshot(page, { fast: true }),
		);
		if (earlyDesktop) {
			result.screenshots.desktop = earlyDesktop;
		}

		// Start mobile navigation IMMEDIATELY after desktop screenshot — before the
		// upload — so it gets the maximum time to complete in the background while
		// Phase 1 collectors and the desktop upload run concurrently.
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

		// ── Phase 1 — data collectors + desktop upload (all parallel) ─────────
		// Desktop upload (≤ 20 s with timeout) runs alongside collectors (axe ≤ 20 s)
		// so neither blocks the other.  Mobile navigation has already been running
		// since before Phase 1 started, maximising its head-start.
		const [
			,
			// desktop upload — result ignored; errors caught inside uploadScreenshot
			r_brokenStates,
			r_links,
			r_interactive,
			r_seoData,
			r_axe,
		] = await Promise.allSettled([
			earlyDesktop ?
				(writer?.uploadScreenshot('desktop', earlyDesktop) ?? Promise.resolve())
			:	Promise.resolve(),
			runStep(result.steps, 'broken_states', async () => {
				const data = await collectBrokenStates(page);
				await writer?.flushSlice('broken_states', data);
				return data;
			}),
			runStep(result.steps, 'links', async () => {
				const data = await collectLinks(page, url);
				await writer?.flushSlice('links', data);
				return data;
			}),
			runStep(result.steps, 'interactive', async () => {
				const data = await collectInteractiveData(page);
				await writer?.flushSlice('interactive', data);
				return data;
			}),
			runStep(result.steps, 'seo', async () => {
				const data = await collectSeoData(page);
				await writer?.flushSlice('seo', data);
				return data;
			}),
			runStep(result.steps, 'axe', async () => {
				const data = await collectAxeViolations(page);
				await writer?.flushSlice('accessibility', data);
				return data;
			}),
		]);

		result.brokenStates = settled(r_brokenStates);
		result.links = settled(r_links);
		result.interactive = settled(r_interactive);
		result.seoData = settled(r_seoData);
		result.axe = settled(r_axe);

		// ── Desktop upload retry ───────────────────────────────────────────────
		// The upload ran concurrently with Phase 1 above.  If Supabase had a
		// transient hiccup the upload failed silently (caught inside uploadScreenshot).
		// The buffer is still in scope — no re-navigation needed — so retry once.
		// Phase 1 took ~20 s, giving Supabase time to recover before this attempt.
		if (earlyDesktop && writer && !writer.hasScreenshot('desktop')) {
			await writer.uploadScreenshot('desktop', earlyDesktop);
		}

		// ── Phase 2 — mobile screenshot ───────────────────────────────────────
		// Wrapped in a Node.js-level timeout (MOBILE_PHASE_TIMEOUT_MS).
		// If Browserbase CDP becomes congested, page.screenshot()'s built-in
		// timeout stops firing (it is itself a CDP message).  The Node.js timer
		// runs outside the CDP channel — when it fires it force-closes the mobile
		// context, which causes any pending Playwright call to throw immediately,
		// unblocking the phase cleanly instead of burning the 240 s budget.
		let mobileContextToClose: BrowserContext | null = null;

		const mobileScreenshot = await Promise.race([
			mobileNavigationPromise.then(async (mobileNav) => {
				if (!mobileNav) return undefined;
				// Store ref so the timeout can force-close it if needed.
				mobileContextToClose = mobileNav.page.context();
				return captureMobileFromNavigation(mobileNav, result, writer);
			}),
			new Promise<undefined>((resolve) => {
				setTimeout(() => {
					// Force-close the mobile context to unblock any hanging CDP call.
					if (mobileContextToClose) void closeContext(mobileContextToClose);
					result.warnings.push(
						`mobile_phase_timeout: mobile screenshot skipped after ${MOBILE_PHASE_TIMEOUT_MS}ms`,
					);
					resolve(undefined);
				}, MOBILE_PHASE_TIMEOUT_MS);
			}),
		]);
		if (mobileScreenshot) {
			result.screenshots.mobile = mobileScreenshot;
			await writer?.uploadScreenshot('mobile', mobileScreenshot);
			// Same retry safety-net for mobile: buffer still in scope.
			if (writer && !writer.hasScreenshot('mobile')) {
				await writer.uploadScreenshot('mobile', mobileScreenshot);
			}
		}

		const navigationOk = hasSuccessfulNavigation(result.steps);
		const axeOk = hasSuccessfulAxe(result);

		// ok = navigation succeeded AND at least one collector returned useful data.
		// Screenshots are valuable but not required — seo, links, brokenStates, or
		// axe data alone is enough for a meaningful AI analysis.
		const hasAnyCollectorData =
			axeOk ||
			Boolean(result.seoData) ||
			Boolean(result.links) ||
			Boolean(result.brokenStates) ||
			Boolean(result.interactive) ||
			Boolean(result.screenshots?.desktop);

		result.ok = navigationOk && hasAnyCollectorData;

		if (navigationOk && !axeOk) {
			const axeReason = getAxeFailureReason(result);
			result.warnings.push(
				`Accessibility scan incomplete (${axeReason}). Other checks were still captured.`,
			);
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
		// Contexts are closed inside scanSingleUrl; remote browser stays alive for other pages.
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
