export type RetryOptions = {
	attempts?: number;
	delayMs?: number;
	shouldRetry?: (error: unknown, attempt: number) => boolean;
};

export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
	task: () => Promise<T>,
	options: RetryOptions = {},
): Promise<T> {
	const attempts = Math.max(1, options.attempts ?? 2);
	const delayMs = Math.max(0, options.delayMs ?? 1_000);
	let lastError: unknown;

	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		try {
			return await task();
		} catch (error) {
			lastError = error;

			if (
				attempt >= attempts ||
				options.shouldRetry?.(error, attempt) === false
			) {
				break;
			}

			await sleep(delayMs * attempt);
		}
	}

	throw lastError;
}
