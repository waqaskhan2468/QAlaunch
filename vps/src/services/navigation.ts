import type { BrowserContext, Page } from 'playwright';
import type { ScanResult, ScanStep } from '../types/scan.types';

const NAV_TIMEOUT = 15_000;
const NETWORK_IDLE_TIMEOUT = 3_000;
const EXTRA_WAIT_MS = 500;

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
): Promise<NavigationResult> {
	try {
		await page.goto(url, {
			waitUntil: 'domcontentloaded',
			timeout: NAV_TIMEOUT,
		});

		const networkIdleWarning = await waitForShortNetworkIdle(page);
		await page.waitForTimeout(EXTRA_WAIT_MS);

		return {
			strategy:
				networkIdleWarning ? 'domcontentloaded' : (
					'domcontentloaded+networkidle'
				),
			...(networkIdleWarning ? { warning: networkIdleWarning } : {}),
		};
	} catch (domContentLoadedError) {
		await page.goto(url, {
			waitUntil: 'load',
			timeout: NAV_TIMEOUT,
		});

		const networkIdleWarning = await waitForShortNetworkIdle(page);
		await page.waitForTimeout(EXTRA_WAIT_MS);

		return {
			strategy: networkIdleWarning ? 'load' : 'load+networkidle',
			warning: [
				`domcontentloaded failed, fallback used: ${cleanError(
					domContentLoadedError,
				)}`,
				networkIdleWarning,
			]
				.filter(Boolean)
				.join(' | '),
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

export async function navigatePage(
	page: Page,
	url: string,
	result: ScanResult,
): Promise<void> {
	try {
		const navigation = await safeGoto(page, url);

		if (navigation.warning) {
			result.warnings.push(navigation.warning);
		}

		addStep(result.steps, `navigate:${navigation.strategy}`, true);
	} catch (error) {
		const message = cleanError(error);
		addStep(result.steps, 'navigate', false, message);
		throw new Error(`Navigation failed: ${message}`);
	}
}
