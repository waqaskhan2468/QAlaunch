export type ConcurrencyLimiter = <T>(fn: () => Promise<T>) => Promise<T>;

/** Sliding-window concurrency limiter (p-limit compatible API). */
export function createConcurrencyLimit(
	concurrency: number,
): ConcurrencyLimiter {
	const max = Math.max(1, Math.floor(concurrency));
	let activeCount = 0;
	const queue: Array<() => void> = [];

	const pump = () => {
		while (activeCount < max && queue.length > 0) {
			activeCount++;
			queue.shift()?.();
		}
	};

	return <T>(fn: () => Promise<T>): Promise<T> =>
		new Promise<T>((resolve, reject) => {
			const run = () => {
				void fn()
					.then(resolve, reject)
					.finally(() => {
						activeCount--;
						pump();
					});
			};

			if (activeCount < max) {
				activeCount++;
				run();
			} else {
				queue.push(run);
			}
		});
}
