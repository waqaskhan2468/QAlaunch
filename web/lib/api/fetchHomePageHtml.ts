import { Agent, fetch as undiciFetch } from 'undici';

import { withRetry } from '@/lib/scan/services/retry';



const FETCH_HOMEPAGE_TIMEOUT_MS = 25_000;

const FETCH_CONNECT_TIMEOUT_MS = 25_000;

const FETCH_ATTEMPTS = 3;



const homepageFetchAgent = new Agent({

	connectTimeout: FETCH_CONNECT_TIMEOUT_MS,

});



function formatFetchError(error: unknown, url: string): Error {

	if (error instanceof Error && error.name === 'AbortError') {

		return new Error(

			`Homepage fetch timed out after ${FETCH_HOMEPAGE_TIMEOUT_MS}ms: ${url}`,

		);

	}



	const message = error instanceof Error ? error.message : String(error);

	const cause =

		error instanceof Error && error.cause instanceof Error ?

			error.cause.message

		:	null;
	return new Error(`Homepage fetch error: ${message}: ${url}`);
}

export async function fetchHomepageHtml(url: string): Promise<string | null> {
	return withRetry(
		async () => {
			const controller = new AbortController();
			const timeout = setTimeout(
				() => controller.abort(),
				FETCH_HOMEPAGE_TIMEOUT_MS,
			);

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

				return await response.text();
			} catch (error) {
				throw formatFetchError(error, url);
			} finally {
				clearTimeout(timeout);
			}
		},
		{ attempts: FETCH_ATTEMPTS, delayMs: 1_000 },
	);
}
