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
	if (
		message === 'Connection error.' ||
		message === 'Request timed out.'
	) {
		return 'Could not connect to the browser service. Please try again in a moment.';
	}
	if (
		message.includes('session not running') ||
		message.includes('410 Gone') ||
		message.includes('browser has been closed') ||
		message.includes('Target page, context or browser')
	) {
		return 'The browser session ended unexpectedly. Please run the scan again.';
	}
	if (
		/invalid project id/i.test(message) ||
		/BROWSERBASE_(API_KEY|PROJECT_ID)/i.test(message) ||
		/Browserbase session missing/i.test(message)
	) {
		return 'Could not start a browser session. Check Browserbase configuration.';
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
	if (message.includes('claude_tool_use_truncated')) {
		return 'AI response was cut short (token limit). Please try again.';
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
	if (
		message.includes('fetch failed') ||
		message.includes('Failed to update scan in storage') ||
		message.includes('artifact upload')
	) {
		return 'Could not save scan results. Please try again.';
	}

	if (message.includes('Invalid Supabase public screenshot URL')) {
		return 'Could not access page screenshots for AI analysis. Please try again.';
	}

	return 'An unexpected error occurred. Please try again.';
}

export async function failScan(
	supabase: ServiceSupabase,
	scanId: string,
	error: unknown,
): Promise<void> {
	const message = toUserFacingScanError(error);
	await markScannerFailed(supabase, scanId, message);
}
