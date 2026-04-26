import type { Browser } from 'playwright';
import type { ResponsiveResult } from '../types/scan.types';
import { closeContext, safeGoto } from './navigation';
import { takeScreenshot } from './screenshots';

const RESPONSIVE_VIEWPORTS = [
	{ name: 'iPhone SE', width: 375, height: 667 },
	{ name: 'iPhone 14', width: 390, height: 844 },
	{ name: 'iPad', width: 768, height: 1024 },
];

type ResponsiveViewport = (typeof RESPONSIVE_VIEWPORTS)[number];

async function scanViewport(
	browser: Browser,
	url: string,
	viewport: ResponsiveViewport,
): Promise<ResponsiveResult> {
	const context = await browser.newContext({
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
	return Promise.all(
		RESPONSIVE_VIEWPORTS.map((viewport) =>
			scanViewport(browser, url, viewport),
		),
	);
}
