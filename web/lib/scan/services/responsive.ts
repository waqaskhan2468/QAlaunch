import { devices, type Browser } from 'playwright-core';
import type { ResponsiveResult } from '../types/scan.types';
import { closeContext, safeGoto } from './navigation';
import { withRetry } from './retry';
import {
	preparePageForScreenshot,
	takeScreenshot,
} from './screenshots';

export const MOBILE_VIEWPORT_NAME = 'iPhone 14';

// Viewport width threshold: ≤ this value uses the mobile capture branch
// (single full-page PNG; see plan-scanner-roadmap Phase A2).
const MOBILE_WIDTH_THRESHOLD = 430;

const RESPONSIVE_VIEWPORTS = [
	{ name: MOBILE_VIEWPORT_NAME, width: 390, height: 844 },
];

type ResponsiveViewport = (typeof RESPONSIVE_VIEWPORTS)[number];

async function navigateForResponsiveCapture(
	browser: Browser,
	url: string,
	viewport: ResponsiveViewport,
): Promise<import('playwright-core').Page> {
	const context = await browser.newContext({
		// Apply full iPhone 14 device emulation (UA, touch, pixel ratio) for
		// the primary mobile viewport; bare width/height for everything else.
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

		try {
			await safeGoto(page, url);
		} catch (error) {
			// Some sites never fully settle in emulated/mobile contexts. Fall back
			// to a less strict navigation target so we can still capture screenshots.
			console.warn('[responsive] safeGoto failed, trying commit fallback', {
				url,
				viewport: viewport.name,
				error: error instanceof Error ? error.message : String(error),
			});

			await page.goto(url, {
				waitUntil: 'commit',
				timeout: 20_000,
			});
		}

		return page;
	} catch (error) {
		await closeContext(context);
		throw error;
	}
}

async function scanViewport(
	browser: Browser,
	url: string,
	viewport: ResponsiveViewport,
): Promise<ResponsiveResult> {
	const page = await navigateForResponsiveCapture(browser, url, viewport);
	const context = page.context();

	try {
		// Keep animations enabled for responsive captures so that
		// IntersectionObserver-based reveals fire during the lazy-load scroll.
		await preparePageForScreenshot(page, { disableAnimations: false });

		const hasHorizontalScroll = await page.evaluate(
			() =>
				document.documentElement.scrollWidth >
				document.documentElement.clientWidth,
		);

		const isMobile = viewport.width <= MOBILE_WIDTH_THRESHOLD;

		if (isMobile) {
			// ── Mobile: single full-page PNG (same semantics as desktop) ────
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

		// ── Non-mobile fallback: single full-page screenshot ──────────────
		return {
			viewport: viewport.name,
			width: viewport.width,
			height: viewport.height,
			hasHorizontalScroll,
			screenshot: await takeScreenshot(page),
			sliceCount: 1,
		};
	} finally {
		await closeContext(context);
	}
}

export async function collectResponsive(
	browser: Browser,
	url: string,
): Promise<ResponsiveResult[]> {
	const results: ResponsiveResult[] = [];

	for (const viewport of RESPONSIVE_VIEWPORTS) {
		try {
			results.push(
				await withRetry(() => scanViewport(browser, url, viewport), {
					attempts: 2,
					delayMs: 1_000,
				}),
			);
		} catch (error) {
			console.warn('[responsive] viewport capture failed', {
				url,
				viewport: viewport.name,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	if (results.length === 0) {
		throw new Error('all_responsive_viewports_failed');
	}

	return results;
}
