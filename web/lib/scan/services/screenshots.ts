import type { Page } from 'playwright-core';
import { logScanTiming } from './scan-timing';

type ScreenshotOptions = NonNullable<Parameters<Page['screenshot']>[0]>;

type ScreenshotTiming = {
	scanId?: string;
	pageUrl?: string;
	viewport?: string;
	/** Scan package/tier that triggered this capture (free vs paid). */
	tier?: string;
};

const DISABLE_ANIMATIONS_CSS = `
  *, *::before, *::after {
    animation-duration:        0s !important;
    animation-delay:           0s !important;
    transition-duration:       0s !important;
    transition-delay:          0s !important;
    scroll-behavior:           auto !important;
  }
`;

const SCREENSHOT_QUALITY = 80;

// Full-page capture so the AI sees below-the-fold content, with a hard
// safeguard against the original hang.
//
// History: fullPage:true was previously removed because it needs CDP scroll
// commands to measure height and capture each segment; on congested Browserbase
// those stalled into 89–114s hangs. Critically, Playwright's own `timeout`
// option is itself a CDP message, so it never fired during those hangs — only a
// Node-level setTimeout could abandon the stuck call.
//
// So we attempt full-page first but race it against a real Node `setTimeout`
// (FULL_PAGE_CEILING_MS). If full-page doesn't complete in time, we fall back to
// a fast viewport-only capture (the original always-reliable path) rather than
// letting the step hang. Both ceilings together stay under the outer per-page
// ceilings in services/index.ts (desktop 14s / mobile phase 30s).
const FULL_PAGE_CEILING_MS = 7_000;
const VIEWPORT_FALLBACK_CEILING_MS = 4_000;
// Sub-budget (within FULL_PAGE_CEILING_MS) for the page-height measurement.
const HEIGHT_MEASURE_CEILING_MS = 2_000;

// Cap full-page height for extremely long pages. Chromium can't capture past
// ~16,384px (Skia surface limit) and very tall captures spike memory; the
// Anthropic vision API also rejects images taller than 8,000px. Beyond the cap
// we capture a top clip of MAX_FULL_PAGE_HEIGHT_PX instead of the whole page.
const MAX_FULL_PAGE_HEIGHT_PX = 8_000;
const DEFAULT_CLIP_WIDTH_PX = 1_440;

/**
 * Race a promise against a Node-level timeout. The timer fires on the event loop
 * regardless of CDP state, so a CDP-level hang inside `work` can never stall us
 * past `ceilingMs` — we resolve to `fallback` and abandon the stuck call.
 */
async function withCeiling<T>(
	work: Promise<T>,
	ceilingMs: number,
	fallback: T,
): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<T>((resolve) => {
		timer = setTimeout(() => resolve(fallback), ceilingMs);
	});
	try {
		return await Promise.race([work, timeout]);
	} finally {
		if (timer) clearTimeout(timer);
	}
}

/** Measure full content height, bounded so a congested channel can't stall us. */
async function measureContentHeight(page: Page): Promise<number | null> {
	const measure = page
		.evaluate(() =>
			Math.max(
				document.documentElement?.scrollHeight ?? 0,
				document.body?.scrollHeight ?? 0,
			),
		)
		.then((h) => (typeof h === 'number' && h > 0 ? h : null))
		.catch(() => null);
	return withCeiling(measure, HEIGHT_MEASURE_CEILING_MS, null);
}

/** One full-page capture attempt (height-capped), bounded by FULL_PAGE_CEILING_MS. */
async function captureFullPage(page: Page): Promise<Buffer | undefined> {
	const work = (async () => {
		const base: ScreenshotOptions = {
			type: 'jpeg',
			quality: SCREENSHOT_QUALITY,
			timeout: FULL_PAGE_CEILING_MS,
			animations: 'disabled',
		};

		const height = await measureContentHeight(page);
		const options: ScreenshotOptions =
			height != null && height > MAX_FULL_PAGE_HEIGHT_PX
				? {
						...base,
						// Top clip instead of the whole page — clip uses
						// captureBeyondViewport so no manual scrolling is needed.
						clip: {
							x: 0,
							y: 0,
							width: page.viewportSize()?.width ?? DEFAULT_CLIP_WIDTH_PX,
							height: MAX_FULL_PAGE_HEIGHT_PX,
						},
					}
				: { ...base, fullPage: true };

		const buffer = await page.screenshot(options);
		return buffer?.length ? buffer : undefined;
	})().catch(() => undefined);

	return withCeiling(work, FULL_PAGE_CEILING_MS, undefined);
}

/** Fast viewport-only capture — the original reliable path, used as fallback. */
async function captureViewport(page: Page): Promise<Buffer | undefined> {
	const work = page
		.screenshot({
			fullPage: false,
			type: 'jpeg',
			quality: SCREENSHOT_QUALITY,
			timeout: VIEWPORT_FALLBACK_CEILING_MS,
			animations: 'disabled',
		})
		.then((buffer) => (buffer?.length ? buffer : undefined))
		.catch(() => undefined);

	return withCeiling(work, VIEWPORT_FALLBACK_CEILING_MS, undefined);
}

/**
 * Capture a JPEG screenshot.
 *
 * - `fullPage: false` (free tier) — viewport-only, above-the-fold. Skips the
 *   full-page attempt and its timeout race entirely (no wasted attempt).
 * - `fullPage: true` (paid tiers) — attempts a height-capped full-page capture,
 *   falling back to viewport-only if it can't finish within FULL_PAGE_CEILING_MS.
 *
 * The `screenshot:capture` timing log records `tier` (via `timing`) and `mode`
 * (`viewport_only` | `fullpage` | `viewport_fallback` | `failed`) so production
 * logs can compare free vs paid timing and mode distribution side by side.
 *
 * Returns undefined on failure — a missing screenshot is acceptable since
 * collectors (axe, seo, links) still carry the scan.
 */
export async function captureScreenshot(
	page: Page,
	options: { fullPage: boolean; timing?: ScreenshotTiming },
): Promise<Buffer | undefined> {
	const { fullPage: attemptFullPage, timing } = options;
	const startedAt = Date.now();
	try {
		// Freeze CSS animations so the captured frame isn't mid-transition.
		await page.addStyleTag({ content: DISABLE_ANIMATIONS_CSS }).catch(() => {});

		if (attemptFullPage) {
			const fullPage = await captureFullPage(page);
			if (fullPage) {
				logScanTiming('screenshot:capture', Date.now() - startedAt, {
					...timing,
					ok: true,
					mode: 'fullpage',
					bytes: fullPage.length,
				});
				return fullPage;
			}

			// Full-page timed out or failed — fall back to the reliable viewport path.
			const viewport = await captureViewport(page);
			logScanTiming('screenshot:capture', Date.now() - startedAt, {
				...timing,
				ok: Boolean(viewport),
				mode: viewport ? 'viewport_fallback' : 'failed',
				bytes: viewport?.length ?? 0,
			});
			return viewport;
		}

		// Free tier — viewport-only, no full-page attempt or timeout race.
		const viewport = await captureViewport(page);
		logScanTiming('screenshot:capture', Date.now() - startedAt, {
			...timing,
			ok: Boolean(viewport),
			mode: viewport ? 'viewport_only' : 'failed',
			bytes: viewport?.length ?? 0,
		});
		return viewport;
	} catch (error) {
		logScanTiming('screenshot:capture', Date.now() - startedAt, {
			...timing,
			ok: false,
			error: error instanceof Error ? error.message : 'screenshot_failed',
		});
		return undefined;
	}
}

/**
 * Capture a desktop full-page screenshot (1440-wide viewport, full content
 * height up to the cap). Thin wrapper over captureScreenshot — kept for named
 * import compatibility.
 */
export async function captureDesktopScreenshot(
	page: Page,
	options: {
		fullPage: boolean;
		fast?: boolean;
		timing?: { scanId?: string; pageUrl?: string; tier?: string };
	},
): Promise<Buffer | undefined> {
	return captureScreenshot(page, {
		fullPage: options.fullPage,
		timing: { ...options.timing, viewport: 'desktop' },
	});
}

// ─── Legacy exports (used by responsive.ts) ───────────────────────────────

/**
 * No-op preparation step — kept so responsive.ts can call it without changes.
 * Preparation is now handled inline in captureScreenshot().
 */
export async function preparePageForScreenshot(
	_page: Page,
	_options?: unknown,
): Promise<void> {
	// Nothing — disableAnimations is now inside captureScreenshot.
}

/**
 * takeScreenshot — kept for responsive.ts compatibility.
 * Mobile screenshots use the same full-page (viewport-fallback) path as desktop.
 */
export async function takeScreenshot(
	page: Page,
	options: { fullPage: boolean; timing?: ScreenshotTiming },
): Promise<Buffer> {
	const result = await captureScreenshot(page, options);
	if (!result) {
		throw new Error('screenshot_empty: capture returned no bytes');
	}
	return result;
}
