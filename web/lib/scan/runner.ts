import type { ServiceSupabase } from '@/lib/db/supabase';
import { updateScanPageRecord } from '@/lib/db/supabase-retry';
import { buildPlaywrightIndexPayload } from '@/lib/artifacts';
import type { ScanStatus } from '@/types/zod';

class ScannerError extends Error {
	constructor(
		message: string,
		readonly status = 500,
	) {
		super(message);
		this.name = 'ScannerError';
	}
}

function nowIso(): string {
	return new Date().toISOString();
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : 'unknown_error';
}

function slog(
	level: 'info' | 'warn' | 'error',
	event: string,
	fields: Record<string, unknown> = {},
): void {
	const entry = JSON.stringify({
		ts: new Date().toISOString(),
		level,
		event,
		...fields,
	});
	if (level === 'error') console.error(entry);
	else if (level === 'warn') console.warn(entry);
	else console.log(entry);
}

async function updateScanStatus(
	supabase: ServiceSupabase,
	scanId: string,
	patch: Record<string, unknown>,
): Promise<void> {
	const { error } = await supabase.from('scans').update(patch).eq('id', scanId);

	if (error) {
		throw new ScannerError(`Failed to update scan: ${error.message}`, 500);
	}
}

async function markScanFailed(
	supabase: ServiceSupabase,
	scanId: string,
	message: string,
): Promise<void> {
	await updateScanStatus(supabase, scanId, {
		status: 'failed',
		error_message: message,
		completed_at: nowIso(),
	});
}

/** Record a page that failed after Inngest retries — does not fail the whole scan. */
export async function persistFailedPageIndex(input: {
	scanId: string;
	pageUrl: string;
}): Promise<void> {
	await updateScanPageRecord(input.scanId, input.pageUrl, {
		screenshot_desktop_url: null,
		screenshot_mobile_url: null,
		playwright_data: buildPlaywrightIndexPayload(false),
		axe_violations: null,
		raw_html: null,
	});

	slog('warn', 'scan:page_failed_indexed', {
		scanId: input.scanId,
		pageUrl: input.pageUrl,
	});
}

export async function prepareScannerScan(
	supabase: ServiceSupabase,
	scanId: string,
): Promise<void> {
	await updateScanStatus(supabase, scanId, {
		status: 'analyzing',
		error_message: null,
	});
}

function pageScanSucceeded(row: {
	playwright_data?: { scanOk?: boolean } | null;
}): boolean {
	return row.playwright_data?.scanOk === true;
}

export async function finalizeScannerFromDb(
	supabase: ServiceSupabase,
	scanId: string,
): Promise<ScanStatus> {
	const { data: pages, error } = await supabase
		.from('scan_pages')
		.select('playwright_data')
		.eq('scan_id', scanId);

	if (error) {
		throw new ScannerError(`Failed to load scan pages: ${error.message}`, 500);
	}

	const hasSuccessfulPage = (pages ?? []).some((row) =>
		pageScanSucceeded({
			playwright_data: row.playwright_data as { scanOk?: boolean } | null,
		}),
	);

	const status: ScanStatus = hasSuccessfulPage ? 'analyzing' : 'failed';

	await updateScanStatus(supabase, scanId, {
		status,
		completed_at: status === 'failed' ? nowIso() : null,
		error_message: status === 'failed' ? 'All pages failed to scan.' : null,
	});

	return status;
}

export async function markScannerFailed(
	supabase: ServiceSupabase,
	scanId: string,
	message: string,
): Promise<void> {
	slog('error', 'scan:failed', { scanId, error: message });
	try {
		await markScanFailed(supabase, scanId, message);
	} catch (markFailedError: unknown) {
		slog('error', 'scan:mark_failed_error', {
			scanId,
			error: getErrorMessage(markFailedError),
		});
	}
}
