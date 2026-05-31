import type { Page } from 'playwright-core';
import { logScanTiming } from './scan-timing';

const DISABLE_ANIMATIONS_CSS = `
  *, *::before, *::after {
    animation-duration:        0s !important;
    animation-delay:           0s !important;
    transition-duration:       0s !important;
    transition-delay:          0s !important;
    scroll-behavior:           auto !important;
  }
`;

// Viewport JPEG — above-the-fold only, no scrolling CDP commands.
// Root cause of 114s hangs: fullPage:true requires multiple CDP scroll commands to
// measure page height and capture each segment. On congested Browserbase each scroll
// command stalls, chaining into a multi-minute hang even with a 15s Playwright timeout.
// fullPage:false needs zero scroll commands — just one capture of the visible area.
// Budget: addStyleTag(0.1s) + fonts(3-5s) + capture(1-2s) ≈ 3-7s.
const SCREENSHOT_TIMEOUT_MS = 10_000;
const SCREENSHOT_QUALITY = 80;

/**
 * Capture a viewport-only JPEG screenshot.
 *
 * fullPage:false is the key choice — it avoids all scroll CDP commands that hang on
 * congested Browserbase connections. Viewport is reliable even on very slow sites;
 * full-page is not. Above-the-fold content (hero, nav, layout, contrast) is sufficient
 * for Claude vision analysis.
 *
 * Returns undefined on failure — a missing screenshot is acceptable since
 * collectors (axe, seo, links) still carry the scan.
 */
export async function captureScreenshot(
	page: Page,
	timing?: { scanId?: string; pageUrl?: string; viewport?: string },
): Promise<Buffer | undefined> {
	const startedAt = Date.now();
	try {
		// Freeze CSS animations so the captured frame isn't mid-transition.
		await page.addStyleTag({ content: DISABLE_ANIMATIONS_CSS }).catch(() => {});

		const buffer = await page.screenshot({
			fullPage: false,
			type: 'jpeg',
			quality: SCREENSHOT_QUALITY,
			timeout: SCREENSHOT_TIMEOUT_MS,
			animations: 'disabled',
		});

		const result = buffer?.length ? buffer : undefined;

		logScanTiming('screenshot:capture', Date.now() - startedAt, {
			...timing,
			ok: Boolean(result),
			bytes: result?.length ?? 0,
		});

		return result;
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
 * Capture a desktop screenshot (1440×900 viewport).
 * Thin wrapper used by index.ts — kept for named import compatibility.
 */
export async function captureDesktopScreenshot(
	page: Page,
	options?: {
		fast?: boolean;
		timing?: { scanId?: string; pageUrl?: string };
	},
): Promise<Buffer | undefined> {
	return captureScreenshot(page, { ...options?.timing, viewport: 'desktop' });
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
 * Mobile screenshots use the same simple viewport JPEG path.
 */
export async function takeScreenshot(
	page: Page,
	timing?: { scanId?: string; pageUrl?: string; viewport?: string },
): Promise<Buffer> {
	const result = await captureScreenshot(page, timing);
	if (!result) {
		throw new Error('screenshot_empty: capture returned no bytes');
	}
	return result;
}
