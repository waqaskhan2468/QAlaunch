import { devices, type Browser, type Page } from 'playwright';
import { closeContext, safeGoto } from './navigation';

const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const SCREENSHOT_QUALITY = 75;

async function takeScreenshot(page: Page): Promise<Buffer> {
	return page.screenshot({
		fullPage: true,
		type: 'jpeg',
		quality: SCREENSHOT_QUALITY,
	});
}

export async function captureDesktopScreenshot(page: Page): Promise<Buffer> {
	await page.setViewportSize(DESKTOP_VIEWPORT);
	return takeScreenshot(page);
}

export async function captureMobileScreenshot(
	browser: Browser,
	url: string,
	warnings: string[],
): Promise<Buffer> {
	const iPhone = devices['iPhone 14'];
	const context = await browser.newContext({ ...iPhone });

	try {
		const page = await context.newPage();
		const navigation = await safeGoto(page, url);

		if (navigation.warning) {
			warnings.push(`mobile ${navigation.warning}`);
		}

		return await takeScreenshot(page);
	} finally {
		await closeContext(context);
	}
}

export { takeScreenshot };
