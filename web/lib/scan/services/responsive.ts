import { devices, type Browser, type Page } from 'playwright-core';
import type { ResponsiveResult } from '../types/scan.types';
import { closeContext, getNavTimeoutMs, safeGoto } from './navigation';
import { blockThirdPartyResources } from './resourceBlocklist';
import { preparePageForScreenshot, takeScreenshot } from './screenshots';

export const MOBILE_VIEWPORT_NAME = 'iPhone 14';

// Viewport width threshold: ≤ this value uses the mobile capture branch.
const MOBILE_WIDTH_THRESHOLD = 430;

const RESPONSIVE_VIEWPORTS = [
	{ name: MOBILE_VIEWPORT_NAME, width: 390, height: 844 },
];

type ResponsiveViewport = (typeof RESPONSIVE_VIEWPORTS)[number];

// ─── Internal: navigate a fresh context ───────────────────────────────────

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
		page.setDefaultTimeout(getNavTimeoutMs());
		page.setDefaultNavigationTimeout(getNavTimeoutMs());
		await blockThirdPartyResources(page);

		// safeGoto already attempts domcontentloaded then commit internally.
		// No additional fallback needed here — if safeGoto throws, both
		// attempts already failed and a third commit attempt won't help.
		await safeGoto(page, url);

		return page;
	} catch (error) {
		await closeContext(context);
		throw error;
	}
}

// ─── Internal: capture from an already-navigated page ─────────────────────

async function captureFromPage(
	page: Page,
	viewport: ResponsiveViewport,
): Promise<ResponsiveResult> {
	// Keep animations enabled for responsive captures so IntersectionObserver-
	// based reveals fire during the lazy-load scroll.
	await preparePageForScreenshot(page, { disableAnimations: false });

	const hasHorizontalScroll = await page.evaluate(
		() =>
			document.documentElement.scrollWidth >
			document.documentElement.clientWidth,
	);

	const isMobile = viewport.width <= MOBILE_WIDTH_THRESHOLD;

	if (isMobile) {
		const screenshot = await takeScreenshot(page);
		return {
			viewport: viewport.name,
			width: viewport.width,
			height: viewport.height,
			hasHorizontalScroll,
			screenshot,
			sliceCount: 1,
		};
	}

	return {
		viewport: viewport.name,
		width: viewport.width,
		height: viewport.height,
		hasHorizontalScroll,
		screenshot: await takeScreenshot(page),
		sliceCount: 1,
	};
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Capture a responsive result from a **pre-navigated** mobile Page.
 *
 * Use this when you have already navigated the mobile page in a background
 * context (e.g. started in parallel with desktop data collection). This avoids
 * the cost of a second navigation to the same URL.
 *
 * The caller is responsible for closing the page/context after this returns.
 *
 * @param page    Already-navigated Playwright Page with mobile viewport set.
 * @param viewport Viewport metadata (name, width, height).
 */
export async function captureResponsiveFromPage(
	page: Page,
	viewport: ResponsiveViewport = RESPONSIVE_VIEWPORTS[0],
): Promise<ResponsiveResult> {
	return captureFromPage(page, viewport);
}

/**
 * Start a mobile browser context and navigate to `url` in the background.
 *
 * Returns a Promise that resolves to `{ page, context }` once navigation
 * completes. The caller must close the context when done.
 *
 * Designed to be fired at the top of a scan and awaited only when the
 * screenshot is actually needed — so navigation happens concurrently with
 * desktop data collection (axe, links, seo, etc.).
 */
export async function startMobileNavigation(
	browser: Browser,
	url: string,
): Promise<{ page: Page; viewport: ResponsiveViewport }> {
	const viewport = RESPONSIVE_VIEWPORTS[0];
	const page = await navigateForResponsiveCapture(browser, url, viewport);
	return { page, viewport };
}
