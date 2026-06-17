import type { Browser, BrowserContext, Page } from 'playwright-core';
import type { ScanWriter } from '@/lib/scan/scan-writer';
import type { BrowserbaseSession } from '@/lib/scan/browser';
import {
	closeBrowserSession,
	connectBrowserbase,
	createBrowserbaseSession,
} from '@/lib/scan/browser';
import type { ScanResult, ScanStep } from '../types/scan.types';
import type { ScanPackage } from '@/types/zod';
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
import { collectInteractionProbes } from './interactionProbes';
import { collectBrokenStates } from './brokenStates';
import { collectInteractionTests } from './interactionTests';
import { logScanTiming } from './scan-timing';

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

// Node.js-level ceiling for desktop screenshot capture — the outer backstop.
// captureScreenshot tries full-page (≤7s) then falls back to viewport-only (≤4s),
// ~11s worst case internally, each guarded by its own Node-level setTimeout.
// This 14s ceiling sits above that internal budget so a CDP-level hang in
// full-page can never orphan the goroutine and block context.close() — the
// historical 114s failure mode. (Full-page itself is back, but bounded.)
const DESKTOP_SCREENSHOT_TIMEOUT_MS = 14_000;

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
			logScanTiming('scan:page_timeout', timeoutMs, {
				scanId,
				pageUrl: url,
				ok: false,
				timeoutMs,
			});
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
	fullPage: boolean,
	timing?: { scanId: string; pageUrl: string; tier?: string },
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
			captureResponsiveFromPage(mobilePage, mobileNav.viewport, fullPage, timing),
		);

		if (responsiveResult) {
			result.responsive = [responsiveResult];
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
	pkg: ScanPackage | undefined,
	isHomepage: boolean,
	writer?: ScanWriter,
	registerAbort?: (abort: () => Promise<void>) => void,
): Promise<ScanResult> {
	const context = await browser.newContext({ viewport: DESKTOP_VIEWPORT });
	const result = createEmptyScanResult(scanId, url);
	const scanStartedAt = Date.now();
	// Paid tiers get full-page capture; free stays viewport-only (fast/cheap).
	// Unknown package defaults to viewport-only as the conservative choice.
	const attemptFullPage = pkg != null && pkg !== 'free';
	const stepTiming = { scanId, pageUrl: url, tier: pkg ?? 'unknown' };

	registerAbort?.(() => closeContext(context));

	try {
		const page = await context.newPage();

		hardenPage(page);
		await blockThirdPartyResources(page);

		attachPageDiagnostics(page, result);

		await navigatePage(page, url, result);

		result.screenshots = {};

		// Start mobile navigation IMMEDIATELY after navigation — before the desktop
		// screenshot — so it gets the maximum head-start while Phase 1 runs.
		const mobileNavigationPromise = startMobileNavigation(browser, url, stepTiming).catch(
			(err) => {
				console.warn('[scan] mobile navigation background start failed', {
					url,
					scanId,
					error: err instanceof Error ? err.message : String(err),
				});
				return null;
			},
		);

		// ── Phase 1 — data collectors + desktop screenshot (all parallel) ──────
		// Desktop screenshot now runs INSIDE Phase 1, not before it.
		//
		// Root cause of scan 488712d7 failure: page.screenshot() hung for 89 s on
		// Browserbase CDP (font-loading wait via document.fonts.ready never resolved
		// because the CDP channel was congested).  Playwright's own timeout is also
		// a CDP message — it never fired either.  Running screenshot before Phase 1
		// meant axe, links, and seo never ran at all before the 120 s budget expired.
		//
		// Fix: screenshot runs in parallel with collectors, wrapped in a Node.js
		// setTimeout ceiling (DESKTOP_SCREENSHOT_TIMEOUT_MS = 15 s).  The setTimeout
		// fires on the Node.js event loop regardless of CDP state — when it fires,
		// the race resolves with undefined, Phase 1 completes, and collectors are
		// returned.  The stuck page.screenshot() call is abandoned in the background.
		const phase1StartedAt = Date.now();
		// Run collectLinks once and share the in-flight promise: the interaction-test
		// suite reuses its HEAD-check results + target/rel attributes instead of
		// re-fetching nav links / re-reading link attributes. Both still run
		// concurrently, so there's no added latency.
		const linksStep = runStep(result.steps, 'links', () =>
			collectLinks(page, url, stepTiming),
		);
		const [
			r_screenshot,
			r_brokenStates,
			r_links,
			r_interactive,
			r_seoData,
			r_axe,
			r_interactionTests,
		] = await Promise.allSettled([
			new Promise<Buffer | undefined>((resolve) => {
				const nodeTimer = setTimeout(() => {
					result.warnings.push(
						`desktop_screenshot_timeout: skipped after ${DESKTOP_SCREENSHOT_TIMEOUT_MS}ms`,
					);
					resolve(undefined);
				}, DESKTOP_SCREENSHOT_TIMEOUT_MS);
				runStep(result.steps, 'screenshot:desktop', () =>
					captureDesktopScreenshot(page, {
						fullPage: attemptFullPage,
						fast: true,
						timing: stepTiming,
					}),
				)
					.then((buf) => {
						clearTimeout(nodeTimer);
						resolve(buf);
					})
					.catch(() => {
						clearTimeout(nodeTimer);
						resolve(undefined);
					});
			}),
			runStep(result.steps, 'broken_states', () =>
				collectBrokenStates(page, { timing: stepTiming }),
			),
			linksStep,
			runStep(result.steps, 'interactive', () =>
				collectInteractiveData(page, stepTiming),
			),
			runStep(result.steps, 'seo', () =>
				collectSeoData(page, stepTiming),
			),
			runStep(result.steps, 'axe', () =>
				collectAxeViolations(page, stepTiming),
			),
			runStep(result.steps, 'interaction_tests', () =>
				collectInteractionTests(page, url, stepTiming, {
					linksPromise: linksStep,
				}),
			),
		]);

		const desktopScreenshot = settled(r_screenshot);
		if (desktopScreenshot) {
			result.screenshots.desktop = desktopScreenshot;
		}

		result.brokenStates = settled(r_brokenStates);
		result.links = settled(r_links);
		result.interactive = settled(r_interactive);
		result.seoData = settled(r_seoData);
		result.axe = settled(r_axe);
		result.interactionTests = settled(r_interactionTests);

		logScanTiming('phase1_collectors', Date.now() - phase1StartedAt, {
			...stepTiming,
			ok: true,
			hasDesktopScreenshot: Boolean(desktopScreenshot),
		});

		// ── Desktop upload (after Phase 1) ────────────────────────────────────
		// Runs sequentially after Phase 1 so it never competes with collectors.
		// Retry once if the first attempt failed silently — buffer still in scope.
		if (desktopScreenshot) {
			await writer?.uploadScreenshot('desktop', desktopScreenshot);
			if (writer && !writer.hasScreenshot('desktop')) {
				await writer.uploadScreenshot('desktop', desktopScreenshot);
			}
		}

		// ── Phase 2 — mobile screenshot ───────────────────────────────────────
		const phase2StartedAt = Date.now();
		let mobileContextToClose: BrowserContext | null = null;

		const mobileScreenshot = await Promise.race([
			mobileNavigationPromise.then(async (mobileNav) => {
				if (!mobileNav) return undefined;
				mobileContextToClose = mobileNav.page.context();
				return captureMobileFromNavigation(
					mobileNav,
					result,
					attemptFullPage,
					stepTiming,
				);
			}),
			new Promise<undefined>((resolve) => {
				setTimeout(() => {
					if (mobileContextToClose) void closeContext(mobileContextToClose);
					result.warnings.push(
						`mobile_phase_timeout: mobile screenshot skipped after ${MOBILE_PHASE_TIMEOUT_MS}ms`,
					);
					logScanTiming('phase2_mobile:timeout', MOBILE_PHASE_TIMEOUT_MS, {
						...stepTiming,
						ok: false,
						error: 'mobile_phase_timeout',
					});
					resolve(undefined);
				}, MOBILE_PHASE_TIMEOUT_MS);
			}),
		]);

		logScanTiming('phase2_mobile', Date.now() - phase2StartedAt, {
			...stepTiming,
			ok: Boolean(mobileScreenshot),
			hasMobileScreenshot: Boolean(mobileScreenshot),
		});

		if (mobileScreenshot) {
			result.screenshots.mobile = mobileScreenshot;
			await writer?.uploadScreenshot('mobile', mobileScreenshot);
			if (writer && !writer.hasScreenshot('mobile')) {
				await writer.uploadScreenshot('mobile', mobileScreenshot);
			}
		}

		// ── Phase 3 — active interaction probes ────────────────────────────────
		// Runs LAST, on the now-idle desktop page, because these checks scroll /
		// click / navigate (unlike the Phase 1 collectors, which must not). Each
		// probe is independently guarded + time-boxed; the whole phase is wrapped
		// so it can never crash the page scan. Site-wide checks (sticky nav, footer
		// scroll) run only on the homepage; per-page checks run on every page.
		try {
			result.interactionProbes = await collectInteractionProbes(page, url, {
				siteWide: isHomepage,
				links: result.links,
				timing: stepTiming,
			});
		} catch (error) {
			result.warnings.push(
				`interaction_probes_failed: ${error instanceof Error ? error.message : 'unknown'}`,
			);
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

		logScanTiming('scan:browser_page', Date.now() - scanStartedAt, {
			...stepTiming,
			ok: result.ok,
			hasDesktopScreenshot: Boolean(result.screenshots?.desktop),
			hasMobileScreenshot: Boolean(result.screenshots?.mobile),
		});

		return result;
	} catch (error) {
		result.ok = false;
		result.error = cleanError(error);
		return result;
	} finally {
		// Fire-and-forget: context.close() is a CDP message that hangs when Browserbase
		// is congested. Awaiting it blocks scanSingleUrl from resolving, which consumes
		// the withPageTimeout budget even after all scan work is done.
		// The Browserbase session is cleaned up server-side when the step completes.
		void closeContext(context);
	}
}

async function scanSingleUrlWithTimeout(
	browser: Browser,
	url: string,
	scanId: string,
	pkg: ScanPackage | undefined,
	isHomepage: boolean,
	writer?: ScanWriter,
): Promise<ScanResult> {
	let abortScan: (() => Promise<void>) | null = null;

	const result = await withPageTimeout(
		scanSingleUrl(browser, url, scanId, pkg, isHomepage, writer, (abort) => {
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
	options?: { writer?: ScanWriter; pkg?: ScanPackage; isHomepage?: boolean },
): Promise<ScanResult> {
	const browser = await connectBrowserbase(connectUrl);
	try {
		return await scanSingleUrlWithTimeout(
			browser,
			url,
			scanId,
			options?.pkg,
			options?.isHomepage ?? false,
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
	options?: { writer?: ScanWriter; pkg?: ScanPackage; isHomepage?: boolean },
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
			options?.pkg,
			options?.isHomepage ?? false,
			options?.writer,
		);
	} finally {
		await closeBrowserSession(browser);
	}
}
