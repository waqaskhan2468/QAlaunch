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

	return message.length > 500 ? `${message.slice(0, 497)}…` : message;
}

export async function failScan(
	supabase: ServiceSupabase,
	scanId: string,
	error: unknown,
): Promise<void> {
	await markScannerFailed(supabase, scanId, toUserFacingScanError(error));
}
