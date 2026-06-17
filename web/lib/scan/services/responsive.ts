import { devices, type Browser, type Page } from 'playwright-core';
import type { ResponsiveResult } from '../types/scan.types';
import { closeContext, safeGoto } from './navigation';
import { blockThirdPartyResources } from './resourceBlocklist';
import { preparePageForScreenshot, takeScreenshot } from './screenshots';
import { logScanTiming, timedScanStep } from './scan-timing';

export const MOBILE_VIEWPORT_NAME = 'iPhone 14';

// Mobile navigation runs in the background while desktop collectors run.
// Use a shorter timeout than desktop so a slow site doesn't hold up
// Promise.allSettled for a full SCAN_NAV_TIMEOUT_MS × 2 window.
// Reduced from 20 s → 15 s: mobile nav failing fast is fine — the outer
// MOBILE_PHASE_TIMEOUT_MS (30 s) is the real ceiling and captures both
// nav + screenshot. A 15 s nav timeout gives 15 s for the screenshot itself.
const MOBILE_NAV_TIMEOUT_MS = 15_000;

const RESPONSIVE_VIEWPORTS = [
	{ name: MOBILE_VIEWPORT_NAME, width: 390, height: 844 },
];

type ResponsiveViewport = (typeof RESPONSIVE_VIEWPORTS)[number];

async function navigateForResponsiveCapture(
	browser: Browser,
	url: string,
	viewport: ResponsiveViewport,
	timing?: { scanId?: string; pageUrl?: string; tier?: string },
): Promise<Page> {
	return timedScanStep(
		'mobile:navigate',
		async () => {
			const context = await browser.newContext({
				...(viewport.name === MOBILE_VIEWPORT_NAME ?
					devices[MOBILE_VIEWPORT_NAME]
				:	{}),
				viewport: {
					width: viewport.width,
					height: viewport.height,
				},
			});

			try {
				const page = await context.newPage();
				page.setDefaultTimeout(MOBILE_NAV_TIMEOUT_MS);
				page.setDefaultNavigationTimeout(MOBILE_NAV_TIMEOUT_MS);
				await blockThirdPartyResources(page);

				await safeGoto(page, url, {
					timeout: MOBILE_NAV_TIMEOUT_MS,
					timing: { ...timing, viewport: viewport.name },
				});

				return page;
			} catch (error) {
				await closeContext(context);
				throw error;
			}
		},
		{ ...timing, viewport: viewport.name },
	);
}

async function captureFromPage(
	page: Page,
	viewport: ResponsiveViewport,
	fullPage: boolean,
	timing?: { scanId?: string; pageUrl?: string; tier?: string },
): Promise<ResponsiveResult> {
	return timedScanStep(
		'screenshot:mobile',
		async () => {
			const shotTiming = { ...timing, viewport: viewport.name };
			await preparePageForScreenshot(page, { fast: true, timing: shotTiming });

			const hasHorizontalScroll = await page.evaluate(
				() =>
					document.documentElement.scrollWidth >
					document.documentElement.clientWidth,
			);

			const screenshot = await takeScreenshot(page, {
				fullPage,
				timing: shotTiming,
			});

			return {
				viewport: viewport.name,
				width: viewport.width,
				height: viewport.height,
				hasHorizontalScroll,
				screenshot,
				sliceCount: 1,
			};
		},
		{ ...timing, viewport: viewport.name },
	);
}

/**
 * Capture a responsive result from a pre-navigated mobile Page. Caller closes
 * the context. `fullPage` is threaded from the scan tier (paid → full-page).
 */
export async function captureResponsiveFromPage(
	page: Page,
	viewport: ResponsiveViewport = RESPONSIVE_VIEWPORTS[0],
	fullPage = false,
	timing?: { scanId?: string; pageUrl?: string; tier?: string },
): Promise<ResponsiveResult> {
	return captureFromPage(page, viewport, fullPage, timing);
}

/**
 * Start a mobile browser context and navigate to `url` in the background.
 * Fire at the top of a scan and await only when the screenshot is needed —
 * navigation runs concurrently with desktop data collection.
 */
export async function startMobileNavigation(
	browser: Browser,
	url: string,
	timing?: { scanId?: string; pageUrl?: string; tier?: string },
): Promise<{ page: Page; viewport: ResponsiveViewport }> {
	const startedAt = Date.now();
	const viewport = RESPONSIVE_VIEWPORTS[0];
	const page = await navigateForResponsiveCapture(browser, url, viewport, timing);
	logScanTiming('mobile:navigation_start', Date.now() - startedAt, {
		...timing,
		ok: true,
		viewport: viewport.name,
	});
	return { page, viewport };
}
