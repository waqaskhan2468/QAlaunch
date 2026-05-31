export type ScanTimingFields = {
	scanId?: string;
	pageUrl?: string;
	ok?: boolean;
	error?: string;
};

export function logScanTiming(
	step: string,
	durationMs: number,
	fields: ScanTimingFields & Record<string, unknown> = {},
): void {
	console.log(
		JSON.stringify({
			ts: new Date().toISOString(),
			event: 'scan:step_timing',
			step,
			durationMs,
			...fields,
		}),
	);
}

export async function timedScanStep<T>(
	step: string,
	task: () => Promise<T>,
	fields: ScanTimingFields & Record<string, unknown> = {},
): Promise<T> {
	const startedAt = Date.now();
	try {
		const result = await task();
		logScanTiming(step, Date.now() - startedAt, { ...fields, ok: true });
		return result;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logScanTiming(step, Date.now() - startedAt, {
			...fields,
			ok: false,
			error: message,
		});
		throw error;
	}
}
