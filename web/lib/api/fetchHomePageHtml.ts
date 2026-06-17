import { Agent, fetch as undiciFetch } from 'undici';

import { withRetry } from '@/lib/scan/services/retry';

const FETCH_HOMEPAGE_TIMEOUT_MS = 25_000;
const FETCH_CONNECT_TIMEOUT_MS = 25_000;
const FETCH_ATTEMPTS = 2;

const homepageFetchAgent = new Agent({
	connectTimeout: FETCH_CONNECT_TIMEOUT_MS,
});

export type FetchHomepageOptions = {
	/** Overall per-attempt timeout. Defaults to the full crawl timeout (25s). */
	timeoutMs?: number;
	/** Retry attempts. Defaults to 2. */
	attempts?: number;
};

function formatFetchError(error: unknown, url: string, timeoutMs: number): Error {
	if (error instanceof Error && error.name === 'AbortError') {
		return new Error(
			`Homepage fetch timed out after ${timeoutMs}ms: ${url}`,
			{ cause: error },
		);
	}

	const message = error instanceof Error ? error.message : String(error);

	// Surface the underlying cause (e.g. ECONNREFUSED) when present.
	const cause =
		error instanceof Error && error.cause instanceof Error ?
			error.cause
		:	undefined;

	return new Error(`Homepage fetch error: ${message}: ${url}`, { cause });
}

export async function fetchHomepageHtml(
	url: string,
	options: FetchHomepageOptions = {},
): Promise<string | null> {
	const timeoutMs = options.timeoutMs ?? FETCH_HOMEPAGE_TIMEOUT_MS;
	const attempts = options.attempts ?? FETCH_ATTEMPTS;

	return withRetry(
		async () => {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), timeoutMs);

			try {
				const response = await undiciFetch(url, {
					signal: controller.signal as AbortSignal,
					dispatcher: homepageFetchAgent,
					headers: {
						'User-Agent':
							'Mozilla/5.0 (compatible; QALaunch/1.0; +https://qalaunch.com)',
						Accept: 'text/html,application/xhtml+xml',
					},
				} as Parameters<typeof undiciFetch>[1]);

				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${url}`);
				}

				// Reject non-HTML responses (JSON APIs, PDFs, binary files) so the
				// detection step doesn't try to parse garbage as HTML.
				const contentType = response.headers.get('content-type') ?? '';
				if (!contentType.includes('text/html') && !contentType.includes('xhtml')) {
					throw new Error(
						`Unexpected content-type "${contentType}" (expected text/html): ${url}`,
					);
				}

				return await response.text();
			} catch (error) {
				throw formatFetchError(error, url, timeoutMs);
			} finally {
				clearTimeout(timeout);
			}
		},
		{ attempts, delayMs: 1_000 },
	);
}
