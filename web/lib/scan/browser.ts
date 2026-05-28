import Browserbase from '@browserbasehq/sdk';
import type { SessionCreateParams } from '@browserbasehq/sdk/resources/sessions/sessions';
import { chromium, type Browser } from 'playwright-core';

// Page scan timeout is 240 s (services/index.ts) plus ~25 s setup overhead.
// 300 s gives a 35 s safety margin so the session never expires mid-scan.
const DEFAULT_SESSION_TIMEOUT_SEC = 300;

const DESKTOP_VIEWPORT = { width: 1440, height: 900 };

type BrowserbaseRegion = NonNullable<SessionCreateParams['region']>;

const VALID_REGIONS: BrowserbaseRegion[] = [
	'us-west-2',
	'us-east-1',
	'eu-central-1',
	'ap-southeast-1',
];

/** Per-attempt ceiling — SDK default can hang ~60s on a dead TCP connect. */
const SESSION_CREATE_TIMEOUT_MS = 25_000;
const CDP_CONNECT_TIMEOUT_MS = 30_000;
const MAX_SESSION_CREATE_RETRIES = 3;

function getSessionTimeoutSec(): number {
	const raw = Number.parseInt(
		process.env.BROWSERBASE_SESSION_TIMEOUT_SEC ?? '',
		10,
	);
	if (!Number.isFinite(raw) || raw < 60) return DEFAULT_SESSION_TIMEOUT_SEC;
	return Math.min(raw, 6 * 3600);
}

function getBrowserbaseRegion(): BrowserbaseRegion | undefined {
	const raw = process.env.BROWSERBASE_REGION?.trim();
	if (!raw) return 'us-east-1';
	return VALID_REGIONS.includes(raw as BrowserbaseRegion) ?
			(raw as BrowserbaseRegion)
		:	'us-east-1';
}

function getBrowserSettings(): SessionCreateParams.BrowserSettings {
	return {
		blockAds: true,
		solveCaptchas: true,
		recordSession: false,
		logSession: false,
		viewport: DESKTOP_VIEWPORT,
	};
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

function isConnectionError(error: unknown): boolean {
	if (!error || typeof error !== 'object') return false;

	const name =
		(error as { constructor?: { name?: string } }).constructor?.name ??
		(error as Error).name ??
		'';

	if (
		name === 'APIConnectionError' ||
		name === 'APIConnectionTimeoutError'
	) {
		return true;
	}

	const message = error instanceof Error ? error.message : String(error);
	return (
		message === 'Connection error.' ||
		message === 'Request timed out.' ||
		/connect timeout/i.test(message) ||
		/timed out after/i.test(message)
	);
}

function connectionErrorDetail(error: unknown): string {
	if (!(error instanceof Error)) return String(error);
	const cause =
		error.cause instanceof Error ? error.cause.message
		: error.cause != null ? String(error.cause)
		: '';
	return cause && !error.message.includes(cause) ?
			`${error.message} (${cause})`
		:	error.message;
}

function withTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
	label: string,
): Promise<T> {
	return Promise.race([
		promise,
		new Promise<T>((_, reject) => {
			setTimeout(() => {
				reject(new Error(`${label} timed out after ${timeoutMs}ms`));
			}, timeoutMs);
		}),
	]);
}

function isSessionAlreadyClosedError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return /410|session not running|Gone|REQUEST_RELEASE|COMPLETED|not found/i.test(
		message,
	);
}

function getBrowserbaseClient(): Browserbase {
	const apiKey = process.env.BROWSERBASE_API_KEY?.trim();
	if (!apiKey) {
		throw new Error('BROWSERBASE_API_KEY is not configured.');
	}
	return new Browserbase({ apiKey });
}

export type BrowserbaseSession = {
	id: string;
	connectUrl: string;
};

/** Browserbase rejects metadata values containing `://`, `/`, etc. — use host + path slug only. */
export function pageUrlForBrowserbaseMetadata(pageUrl: string): string {
	try {
		const { hostname, pathname } = new URL(pageUrl);
		const pathSlug =
			pathname === '/' || !pathname
				? ''
				: pathname
						.replace(/^\//, '')
						.replace(/[^a-zA-Z0-9.-]+/g, '_')
						.replace(/^_|_$/g, '');
		const slug = pathSlug ? `${hostname}_${pathSlug}` : hostname;
		return slug.slice(0, 200);
	} catch {
		return pageUrl
			.replace(/[^a-zA-Z0-9._-]+/g, '_')
			.replace(/^_|_$/g, '')
			.slice(0, 200);
	}
}

export async function createBrowserbaseSession(
	scanId: string,
	pageUrl?: string,
): Promise<BrowserbaseSession> {
	const bb = getBrowserbaseClient();
	const projectId = process.env.BROWSERBASE_PROJECT_ID?.trim();

	let lastError: unknown;
	type BBSession = Awaited<ReturnType<typeof bb.sessions.create>>;

	for (let attempt = 0; attempt < MAX_SESSION_CREATE_RETRIES; attempt += 1) {
		const startedAt = Date.now();
		try {
			const session = await withTimeout<BBSession>(
				bb.sessions.create({
					...(projectId ? { projectId } : {}),
					region: getBrowserbaseRegion(),
					browserSettings: getBrowserSettings(),
					timeout: getSessionTimeoutSec(),
					userMetadata: {
						scanId,
						...(pageUrl
							? { pageHost: pageUrlForBrowserbaseMetadata(pageUrl) }
							: {}),
					},
				}),
				SESSION_CREATE_TIMEOUT_MS,
				'Browserbase session create',
			);

			if (!session.connectUrl) {
				throw new Error('Browserbase session missing connectUrl.');
			}

			console.log('[browserbase] session created', {
				scanId,
				sessionId: session.id,
				attempt: attempt + 1,
				durationMs: Date.now() - startedAt,
			});

			return { id: session.id, connectUrl: session.connectUrl };
		} catch (error) {
			lastError = error;
			const isLastAttempt = attempt === MAX_SESSION_CREATE_RETRIES - 1;

			if (isRateLimitError(error) && !isLastAttempt) {
				const backoff = getRetryAfterMs(error) * (attempt + 1);
				console.warn('[browserbase] rate limited, retrying', { scanId, attempt: attempt + 1, backoffMs: backoff });
				await sleep(backoff);
				continue;
			}

			if (isConnectionError(error) && !isLastAttempt) {
				const backoff = 3_000 * (attempt + 1);
				console.warn('[browserbase] connection failed, retrying', { scanId, attempt: attempt + 1, backoffMs: backoff, error: connectionErrorDetail(error) });
				await sleep(backoff);
				continue;
			}

			if (isSessionAlreadyClosedError(error) && !isLastAttempt) {
				await sleep(2_000);
				continue;
			}

			throw error;
		}
	}

	throw lastError instanceof Error
		? lastError
		: new Error('Browserbase session create failed');
}

export async function connectBrowserbase(connectUrl: string): Promise<Browser> {
	const startedAt = Date.now();
	const browser = await withTimeout(
		chromium.connectOverCDP(connectUrl),
		CDP_CONNECT_TIMEOUT_MS,
		'Browserbase CDP connect',
	);
	console.log('[browserbase] cdp connected', {
		durationMs: Date.now() - startedAt,
	});
	return browser;
}

// How long to wait for Playwright to cleanly close the CDP connection.
const BROWSER_CLOSE_TIMEOUT_MS = 8_000;

export async function closeBrowserSession(
	browser: Browser | null,
): Promise<void> {
	if (!browser) return;
	try {
		await Promise.race([
			browser.close(),
			new Promise<void>((resolve) =>
				setTimeout(resolve, BROWSER_CLOSE_TIMEOUT_MS),
			),
		]);
	} catch {
		// Ignore cleanup errors from remote CDP.
	}
}

/** Terminate a shared Browserbase session after all page scans complete. */
export async function closeBrowserbaseSession(
	session: BrowserbaseSession,
): Promise<void> {
	const browser = await connectBrowserbase(session.connectUrl);
	await closeBrowserSession(browser);
}
