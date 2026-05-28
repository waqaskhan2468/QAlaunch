import { devices, type Browser, type Page } from 'playwright-core';
import type { ResponsiveResult } from '../types/scan.types';
import { closeContext, safeGoto } from './navigation';
import { blockThirdPartyResources } from './resourceBlocklist';
import { preparePageForScreenshot, takeScreenshot } from './screenshots';

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
): Promise<Page> {
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
		// Use MOBILE_NAV_TIMEOUT_MS for both defaults so they stay consistent
		// with the explicit timeout passed to safeGoto below.
		page.setDefaultTimeout(MOBILE_NAV_TIMEOUT_MS);
		page.setDefaultNavigationTimeout(MOBILE_NAV_TIMEOUT_MS);
		await blockThirdPartyResources(page);

		await safeGoto(page, url, { timeout: MOBILE_NAV_TIMEOUT_MS });

		return page;
	} catch (error) {
		await closeContext(context);
		throw error;
	}
}

async function captureFromPage(
	page: Page,
	viewport: ResponsiveViewport,
): Promise<ResponsiveResult> {
	// Mobile nav runs for ~30 s while desktop collectors work. By the time we
	// screenshot, IntersectionObserver reveals have already fired and the page is
	// settled — fast mode is safe and saves ~2-3 s of unnecessary prep.
	await preparePageForScreenshot(page, { fast: true });

	const hasHorizontalScroll = await page.evaluate(
		() =>
			document.documentElement.scrollWidth >
			document.documentElement.clientWidth,
	);

	return {
		viewport: viewport.name,
		width: viewport.width,
		height: viewport.height,
		hasHorizontalScroll,
		screenshot: await takeScreenshot(page),
		sliceCount: 1,
	};
}

/** Capture a responsive result from a pre-navigated mobile Page. Caller closes the context. */
export async function captureResponsiveFromPage(
	page: Page,
	viewport: ResponsiveViewport = RESPONSIVE_VIEWPORTS[0],
): Promise<ResponsiveResult> {
	return captureFromPage(page, viewport);
}

/**
 * Start a mobile browser context and navigate to `url` in the background.
 * Fire at the top of a scan and await only when the screenshot is needed —
 * navigation runs concurrently with desktop data collection.
 */
export async function startMobileNavigation(
	browser: Browser,
	url: string,
): Promise<{ page: Page; viewport: ResponsiveViewport }> {
	const viewport = RESPONSIVE_VIEWPORTS[0];
	const page = await navigateForResponsiveCapture(browser, url, viewport);
	return { page, viewport };
}
