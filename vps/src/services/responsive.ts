import { devices, type Browser } from 'playwright';
import type { ResponsiveResult } from '../types/scan.types';
import { closeContext, safeGoto } from './navigation';
import { withRetry } from './retry';
import { takeScreenshot } from './screenshots';

export const MOBILE_VIEWPORT_NAME = 'iPhone 14';

const RESPONSIVE_VIEWPORTS = [
	{ name: 'iPhone SE', width: 375, height: 667 },
	{ name: MOBILE_VIEWPORT_NAME, width: 390, height: 844 },
	{ name: 'iPad', width: 768, height: 1024 },
];

type ResponsiveViewport = (typeof RESPONSIVE_VIEWPORTS)[number];

async function scanViewport(
	browser: Browser,
	url: string,
	viewport: ResponsiveViewport,
): Promise<ResponsiveResult> {
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
		await safeGoto(page, url);

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
		results.push(
			await withRetry(() => scanViewport(browser, url, viewport), {
				attempts: 2,
				delayMs: 1_000,
			}),
		);
	}

	return results;
}
