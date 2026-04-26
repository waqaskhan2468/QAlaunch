import { chromium, type Browser } from 'playwright';
import type { ScanResult, ScanStep } from '../types/scan.types';
import { collectAxeViolations } from './accessibility';
import { attachPageDiagnostics } from './diagnostics';
import { cleanError, closeContext, navigatePage, runStep } from './navigation';
import { collectInteractiveData, collectSeoData } from './seo';
import { collectLinks } from './links';
import { collectResponsive } from './responsive';
import {
	captureDesktopScreenshot,
	captureMobileScreenshot,
} from './screenshots';

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

async function scanSingleUrl(
	browser: Browser,
	url: string,
	scanId: string,
): Promise<ScanResult> {
	const context = await browser.newContext();
	const result = createEmptyScanResult(scanId, url);

	try {
		const page = await context.newPage();
		attachPageDiagnostics(page, result);

		await navigatePage(page, url, result);

		result.screenshots = {};

		const desktopScreenshot = await runStep(
			result.steps,
			'screenshot:desktop',
			() => captureDesktopScreenshot(page),
		);

		if (desktopScreenshot) {
			result.screenshots.desktop = desktopScreenshot;
		}

		const [links, interactive, seoData, axe] = await Promise.all([
			runStep(result.steps, 'links', () => collectLinks(page, url)),
			runStep(result.steps, 'interactive', () => collectInteractiveData(page)),
			runStep(result.steps, 'seo', () => collectSeoData(page)),
			runStep(result.steps, 'axe', () => collectAxeViolations(page)),
		]);

		result.links = links;
		result.interactive = interactive;
		result.seoData = seoData;
		result.axe = axe;

		const [mobileScreenshot, responsive] = await Promise.all([
			runStep(result.steps, 'screenshot:mobile', () =>
				captureMobileScreenshot(browser, url, result.warnings),
			),
			runStep(result.steps, 'responsive', () =>
				collectResponsive(browser, url),
			),
		]);

		if (mobileScreenshot) {
			result.screenshots.mobile = mobileScreenshot;
		}

		result.responsive = responsive;
		result.ok = hasSuccessfulNavigation(result.steps);

		return result;
	} catch (error) {
		result.ok = false;
		result.error = cleanError(error);
		return result;
	} finally {
		await closeContext(context);
	}
}

export async function runPlaywrightScan(
	urls: string[],
	scanId: string,
): Promise<ScanResult[]> {
	const browser = await chromium.launch({ headless: true });

	try {
		const results: ScanResult[] = [];

		for (const url of urls) {
			results.push(await scanSingleUrl(browser, url, scanId));
		}

		return results;
	} finally {
		await browser.close();
	}
}
