import type { ServiceSupabase } from '@/lib/db/supabase';
import { markScannerFailed } from '@/lib/scan/runner';

export function toUserFacingScanError(error: unknown): string {
	const message =
		error instanceof Error ? error.message
		: typeof error === 'string' ? error
		: 'Scan failed. Please try again.';

	if (message.includes('page timeout')) {
		return 'This page took too long to analyze. Try again or check that the site loads quickly.';
	}
	if (/invalid project id/i.test(message) || /browserbase/i.test(message)) {
		return 'Could not start a browser session. Check Browserbase configuration.';
	}
	if (
		message.includes('browser has been closed') ||
		message.includes('Target page, context or browser')
	) {
		return 'The browser session ended unexpectedly. Please run the scan again.';
	}
	if (message.includes('accessibility_gate') || message.includes('axe')) {
		return 'Accessibility analysis did not complete for this page.';
	}
	if (message.includes('all_responsive_viewports_failed')) {
		return 'Mobile layout capture failed. The desktop scan may still be partial.';
	}
	if (
		message.includes('This operation was aborted') ||
		message.includes('AbortError') ||
		/timed?\s*out/i.test(message)
	) {
		return 'Report generation timed out. Please try again.';
	}
	if (message.includes('Invalid Claude issues payload')) {
		return 'Could not build the report from AI output. Please try again.';
	}
	if (/Claude API error:\s*429/.test(message)) {
		return 'AI service is busy. Please wait a moment and try again.';
	}
	if (/Claude API error/i.test(message)) {
		return 'Report generation failed. Please try again.';
	}
	if (message.includes('AI analysis failed for all')) {
		return 'Report generation failed for all pages. Please try again.';
	}
	if (message.includes('ai_page_failed') || message.includes('ai_page_error')) {
		return 'Report generation failed. Please try again.';
	}

	return message.length > 500 ? `${message.slice(0, 497)}…` : message;
}

export async function failScan(
	supabase: ServiceSupabase,
	scanId: string,
	error: unknown,
): Promise<void> {
	await markScannerFailed(supabase, scanId, toUserFacingScanError(error));
}
