import { NonRetriableError } from 'inngest';
import { analyzeScanPageWithClaude } from '@/lib/scan/ai';
import { toUserFacingScanError } from '@/lib/scan/fail-scan';
import { getServiceSupabase } from '@/lib/db/supabase';
import { isRetryableNetworkError } from '@/lib/db/supabase-retry';
import type { ScanPackage } from '@/types/zod';

/**
 * Returns true for errors that Inngest should retry — network blips,
 * Claude 429/500/529 (handled inside analyzeWithClaude first, but may
 * exhaust retries and propagate here), and timeouts.
 */
function isAiRetriable(error: unknown): boolean {
	if (isRetryableNetworkError(error)) return true;
	const message = error instanceof Error ? error.message : String(error);
	return (
		// Claude overload / rate-limit / server error surfaced after exhausting
		// the internal retry loop in analyzeWithClaude
		/Claude API error:\s*(429|500|502|503|504|529)/.test(message) ||
		// AbortError = the 120-second Anthropic timeout fired; worth one Inngest retry
		message.includes('AbortError') ||
		message.includes('This operation was aborted') ||
		// claude_tool_use_truncated: Claude hit max_tokens mid-tool-call — transient
		message.includes('claude_tool_use_truncated') ||
		// Generic Anthropic/Supabase overload message — includes when wrapped in
		// 'Failed to create signed screenshot URL: An unexpected error occurred...'
		message.includes('An unexpected error occurred. Please try again.')
	);
}

export async function analyzePageStep(input: {
	scanId: string;
	pageUrl: string;
	websiteType: string | null;
	pkg: ScanPackage;
}): Promise<void> {
	if (!process.env.ANTHROPIC_API_KEY) {
		throw new NonRetriableError('ANTHROPIC_API_KEY is missing in environment.');
	}

	const supabase = getServiceSupabase();

	try {
		await analyzeScanPageWithClaude(
			supabase,
			input.scanId,
			input.pageUrl,
			input.websiteType,
			input.pkg,
		);
	} catch (error: unknown) {
		// Retriable errors: let Inngest retry the step instead of killing the scan
		if (isAiRetriable(error)) {
			throw error;
		}

		// Permanent failures: wrap as NonRetriableError so Inngest stops retrying
		throw new NonRetriableError(toUserFacingScanError(error));
	}
}
