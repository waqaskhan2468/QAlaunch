import { isRetryableNetworkError } from '@/lib/db/supabase-retry';

/** Browserbase SDK throws APIConnectionError with the generic message "Connection error." */
function isBrowserbaseConnectionError(error: unknown): boolean {
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

	const message = messageOf(error).toLowerCase();
	return (
		message === 'connection error.' ||
		message === 'request timed out.' ||
		message.includes('connect timeout')
	);
}

const NON_RETRIABLE_PATTERNS = [
	'BROWSERBASE_API_KEY',
	'BROWSERBASE_PROJECT_ID',
	'invalid project id',
	'Browserbase session missing connectUrl',
	'cloudflare_challenge',
	// Page timeout: no partial data is saved (ScanWriter only writes in finalize()).
	// Retrying will hit the same wall — mark as non-retriable to stop the loop.
	// persistFailedPageIndex is called by the run-scan.ts catch block instead.
	'page timeout after',
];

const BROWSER_RETRIABLE_PATTERNS = [
	// NOTE: 'page timeout' is intentionally omitted — it is handled as non-retriable
	// above so Inngest does not retry an already-timed-out scan.
	'browser has been closed',
	'Target page, context or browser has been closed',
	'session not running',
	'410 Gone',
	'connectOverCDP',
	'WebSocket',
	'net::ERR_',
	'ECONNREFUSED',
	'ECONNRESET',
	'AbortError',
	'TimeoutError',
];

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export function isBrowserNonRetriable(error: unknown): boolean {
	const message = messageOf(error);
	return NON_RETRIABLE_PATTERNS.some((p) =>
		message.toLowerCase().includes(p.toLowerCase()),
	);
}

export function isBrowserRetriable(error: unknown): boolean {
	if (isBrowserbaseConnectionError(error)) return true;
	if (isRetryableNetworkError(error)) return true;
	const message = messageOf(error);
	return BROWSER_RETRIABLE_PATTERNS.some((p) =>
		message.toLowerCase().includes(p.toLowerCase()),
	);
}

/** Persist step: only infra/network errors are retriable. */
export function isPersistRetriable(error: unknown): boolean {
	return isRetryableNetworkError(error);
}

export function isPersistNonRetriable(error: unknown): boolean {
	const message = messageOf(error).toLowerCase();
	return (
		message.includes('no matching scan_pages row') ||
		message.includes('violates') ||
		message.includes('permission denied')
	);
}
