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

export async function updateScanPageAiAnalysis(
	pageId: string,
	aiAnalysis: unknown,
	options?: { attempts?: number },
): Promise<void> {
	await withRetry(
		async () => {
			const supabase = getServiceSupabase();
			const { error } = await supabase
				.from('scan_pages')
				.update({ ai_analysis: aiAnalysis })
				.eq('id', pageId);

			if (!error) return;

			const err = new Error(error.message);
			if (isNonRetryablePostgrestMessage(error.message)) {
				throw Object.assign(err, { nonRetryable: true as const });
			}
			throw err;
		},
		{
			attempts: options?.attempts ?? 5,
			delayMs: 2_000,
			shouldRetry: (error) => {
				if (
					error &&
					typeof error === 'object' &&
					'nonRetryable' in error &&
					(error as { nonRetryable?: boolean }).nonRetryable
				) {
					return false;
				}
				return isRetryableNetworkError(error);
			},
		},
	);
}
