import Browserbase from '@browserbasehq/sdk';
import { chromium, type Browser } from 'playwright-core';

const DEFAULT_SESSION_TIMEOUT_SEC = 3600;
const MAX_SESSION_CREATE_RETRIES = 5;

function getSessionTimeoutSec(): number {
	const raw = Number.parseInt(
		process.env.BROWSERBASE_SESSION_TIMEOUT_SEC ?? '',
		10,
	);
	if (!Number.isFinite(raw) || raw < 60) return DEFAULT_SESSION_TIMEOUT_SEC;
	return Math.min(raw, 6 * 3600);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryAfterMs(error: unknown): number {
	if (!error || typeof error !== 'object') return 2_000;

	const headers = (error as { headers?: Record<string, string> }).headers;
	const retryAfter = headers?.['retry-after'] ?? headers?.['Retry-After'];
	const parsed = Number.parseInt(String(retryAfter ?? ''), 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed * 1_000 : 2_000;
}

function isRateLimitError(error: unknown): boolean {
	if (!error || typeof error !== 'object') return false;
	const status =
		(error as { status?: number }).status ??
		(error as { statusCode?: number }).statusCode;
	return status === 429;
}

export type BrowserbaseSession = {
	id: string;
	connectUrl: string;
};

export async function createBrowserbaseSession(
	scanId: string,
	pageUrl?: string,
): Promise<BrowserbaseSession> {
	const apiKey = process.env.BROWSERBASE_API_KEY?.trim();
	if (!apiKey) {
		throw new Error('BROWSERBASE_API_KEY is not configured.');
	}

	const projectId = process.env.BROWSERBASE_PROJECT_ID?.trim();
	const bb = new Browserbase({ apiKey });

	let lastError: unknown;

	for (let attempt = 0; attempt < MAX_SESSION_CREATE_RETRIES; attempt += 1) {
		try {
			const session = await bb.sessions.create({
				...(projectId ? { projectId } : {}),
				timeout: getSessionTimeoutSec(),
				userMetadata: {
					scanId,
					...(pageUrl ? { pageUrl: pageUrl.slice(0, 200) } : {}),
				},
			});

			if (!session.connectUrl) {
				throw new Error('Browserbase session missing connectUrl.');
			}

			return { id: session.id, connectUrl: session.connectUrl };
		} catch (error) {
			lastError = error;
			if (!isRateLimitError(error) || attempt === MAX_SESSION_CREATE_RETRIES - 1) {
				throw error;
			}

			const backoff = getRetryAfterMs(error) * Math.pow(2, attempt);
			console.warn('[browserbase] rate limited, retrying session create', {
				scanId,
				attempt: attempt + 1,
				backoffMs: backoff,
			});
			await sleep(backoff);
		}
	}

	throw lastError instanceof Error ? lastError : new Error('Browserbase session create failed');
}

export async function connectBrowserbase(
	connectUrl: string,
): Promise<Browser> {
	return chromium.connectOverCDP(connectUrl);
}

export async function closeBrowserSession(browser: Browser | null): Promise<void> {
	if (!browser) return;
	try {
		await browser.close();
	} catch {
		// Ignore cleanup errors from remote CDP.
	}
}
