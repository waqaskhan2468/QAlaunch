export type RetryOptions = {
	attempts?: number;
	delayMs?: number;
	shouldRetry?: (error: unknown, attempt: number) => boolean;
	/** Hard ceiling per attempt. If the task hasn't resolved within this many ms
	 *  the attempt is abandoned and counted as a failure. */
	timeoutMs?: number;
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
	const { timeoutMs } = options;
	let lastError: unknown;

	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		try {
			const taskPromise = task();
			const result =
				timeoutMs != null
					? await Promise.race([
							taskPromise,
							new Promise<T>((_, reject) =>
								setTimeout(
									() =>
										reject(
											new Error(
												`withRetry: attempt ${attempt} timed out after ${timeoutMs}ms`,
											),
										),
									timeoutMs,
								),
							),
						])
					: await taskPromise;
			return result;
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
