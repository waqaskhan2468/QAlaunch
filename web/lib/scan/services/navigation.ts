import type { BrowserContext, Page, Response } from 'playwright-core';
import type { ScanResult, ScanStep } from '../types/scan.types';
import { buildResponseSecurityMeta } from './responseMeta';

const NAV_TIMEOUT = 15_000;
const NETWORK_IDLE_TIMEOUT = 3_000;
const CONTENT_READY_TIMEOUT = 10_000;
const EXTRA_WAIT_MS = 500;

const MIN_BODY_TEXT_LENGTH = 500;
const MIN_LINK_COUNT = 5;

type NavigationResult = {
	strategy: string;
	warning?: string;
};

export function cleanError(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	return message.replace(/\u001b\[[0-9;]*m/g, '').trim();
}

export function addStep(
	steps: ScanStep[],
	name: string,
	ok: boolean,
	error?: string,
): void {
	steps.push({ name, ok, ...(error ? { error } : {}) });
}

export async function runStep<T>(
	steps: ScanStep[],
	name: string,
	task: () => Promise<T>,
): Promise<T | undefined> {
	try {
		const result = await task();
		addStep(steps, name, true);
		return result;
	} catch (error) {
		addStep(steps, name, false, cleanError(error));
		return undefined;
	}
}

export async function closeContext(
	context: BrowserContext | null,
): Promise<void> {
	if (!context) return;

	try {
		await context.close();
	} catch {
		// Ignore browser cleanup errors.
	}
}

export async function safeGoto(
	page: Page,
	url: string,
): Promise<{ navigation: NavigationResult; response: Response | null }> {
	try {
		const response = await page.goto(url, {
			waitUntil: 'domcontentloaded',
			timeout: NAV_TIMEOUT,
		});

		const warnings = [
			await waitForShortNetworkIdle(page),
			await waitForMeaningfulContent(page),
		].filter(Boolean);

		await page.waitForTimeout(EXTRA_WAIT_MS);

		return {
			navigation: {
				strategy: warnings.length ? 'domcontentloaded' : 'domcontentloaded+ready',
				...(warnings.length ? { warning: warnings.join(' | ') } : {}),
			},
			response,
		};
	} catch (domContentLoadedError) {
		const response = await page.goto(url, {
			waitUntil: 'load',
			timeout: NAV_TIMEOUT,
		});

		const warnings = [
			`domcontentloaded failed, fallback used: ${cleanError(
				domContentLoadedError,
			)}`,
			await waitForShortNetworkIdle(page),
			await waitForMeaningfulContent(page),
		].filter(Boolean);

		await page.waitForTimeout(EXTRA_WAIT_MS);

		return {
			navigation: {
				strategy: warnings.length ? 'load' : 'load+ready',
				...(warnings.length ? { warning: warnings.join(' | ') } : {}),
			},
			response,
		};
	}
}

async function waitForShortNetworkIdle(
	page: Page,
): Promise<string | undefined> {
	try {
		await page.waitForLoadState('networkidle', {
			timeout: NETWORK_IDLE_TIMEOUT,
		});

		return undefined;
	} catch (error) {
		return `networkidle skipped after ${NETWORK_IDLE_TIMEOUT}ms: ${cleanError(
			error,
		)}`;
	}
}

async function waitForMeaningfulContent(
	page: Page,
): Promise<string | undefined> {
	try {
		await page.waitForFunction(
			({ minBodyTextLength, minLinkCount }) => {
				const bodyText = document.body?.innerText?.trim() ?? '';
				const linkCount = document.querySelectorAll('a[href]').length;
				const headingCount = document.querySelectorAll('h1, h2').length;

				return (
					bodyText.length >= minBodyTextLength ||
					linkCount >= minLinkCount ||
					headingCount > 0
				);
			},
			{
				minBodyTextLength: MIN_BODY_TEXT_LENGTH,
				minLinkCount: MIN_LINK_COUNT,
			},
			{
				timeout: CONTENT_READY_TIMEOUT,
			},
		);

		return undefined;
	} catch (error) {
		return `content readiness skipped after ${CONTENT_READY_TIMEOUT}ms: ${cleanError(
			error,
		)}`;
	}
}

export async function navigatePage(
	page: Page,
	url: string,
	result: ScanResult,
): Promise<void> {
	try {
		const { navigation, response } = await safeGoto(page, url);

		if (navigation.warning) {
			result.warnings.push(navigation.warning);
		}

		addStep(result.steps, `navigate:${navigation.strategy}`, true);
		result.responseSecurityMeta = buildResponseSecurityMeta(
			page,
			response,
			url,
		);
	} catch (error) {
		const message = cleanError(error);
		addStep(result.steps, 'navigate', false, message);
		throw new Error(`Navigation failed: ${message}`);
	}
}
