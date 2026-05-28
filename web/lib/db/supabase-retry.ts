import { getServiceSupabase } from '@/lib/db/supabase';
import { withRetry } from '@/lib/scan/services/retry';

export function formatErrorWithCause(error: unknown): string {
	if (!(error instanceof Error)) return String(error);

	const parts = [error.message];
	let cause: unknown = error.cause;
	let depth = 0;

	while (cause != null && depth < 4) {
		parts.push(cause instanceof Error ? cause.message : String(cause));
		cause = cause instanceof Error ? cause.cause : undefined;
		depth += 1;
	}

	return parts.filter((part) => part.length > 0).join(' — ');
}

export function isRetryableNetworkError(error: unknown): boolean {
	const combined = formatErrorWithCause(error).toLowerCase();

	return (
		combined.includes('fetch failed') ||
		combined.includes('connection error') ||
		combined.includes('connect timeout') ||
		combined.includes('econnreset') ||
		combined.includes('etimedout') ||
		combined.includes('enotfound') ||
		combined.includes('socket hang up') ||
		combined.includes('network') ||
		combined.includes('502') ||
		combined.includes('503') ||
		combined.includes('504') ||
		combined.includes('aborted')
	);
}

function isNonRetryablePostgrestMessage(message: string): boolean {
	const lower = message.toLowerCase();
	return (
		lower.includes('violates') ||
		lower.includes('duplicate key') ||
		lower.includes('invalid input') ||
		lower.includes('permission denied') ||
		lower.includes('jwt')
	);
}

function shouldRetrySupabaseMutation(error: unknown): boolean {
	if (
		error &&
		typeof error === 'object' &&
		'nonRetryable' in error &&
		(error as { nonRetryable?: boolean }).nonRetryable
	) {
		return false;
	}
	return isRetryableNetworkError(error);
}

export async function updateScanPageRecord(
	scanId: string,
	pageUrl: string,
	patch: Record<string, unknown>,
	options?: { attempts?: number },
): Promise<void> {
	await withRetry(
		async () => {
			const supabase = getServiceSupabase();
			const { data, error } = await supabase
				.from('scan_pages')
				.update(patch)
				.eq('scan_id', scanId)
				.eq('page_url', pageUrl)
				.select('id');

			if (!error && data?.length) return;

			if (error) {
				const err = new Error(error.message);
				if (isNonRetryablePostgrestMessage(error.message)) {
					const nonRetryable = Object.assign(new Error(error.message), {
						nonRetryable: true,
					});
					throw nonRetryable;
				}
				throw new Error(error.message);
			}

			if (!data?.length) {
				throw Object.assign(
					new Error(`No matching scan_pages row for ${pageUrl}`),
					{ nonRetryable: true },
				);
			}
		},
		{
			attempts: options?.attempts ?? 2,
			delayMs: 1_000,
			shouldRetry: shouldRetrySupabaseMutation,
		},
	);
}

export async function updateScanPageAiAnalysis(
	scanId: string,
	pageUrl: string,
	patch: Record<string, unknown>,
): Promise<void> {
	await updateScanPageRecord(scanId, pageUrl, patch, { attempts: 2 });
}
