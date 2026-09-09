import type { ServiceSupabase } from '@/lib/db/supabase';
import { formatErrorWithCause, updateScanPageRecord } from '@/lib/db/supabase-retry';
import { buildPlaywrightIndexPayload } from '@/lib/scan/playwright-payload';
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
	detail?: string | null,
): Promise<void> {
	await updateScanStatus(supabase, scanId, {
		status: 'failed',
		error_message: message,
		...(detail ? { error_detail: detail.slice(0, 1000) } : {}),
		completed_at: nowIso(),
	});
}

/** Record a page that failed after Inngest retries — does not fail the whole scan. */
export async function persistFailedPageIndex(input: {
	scanId: string;
	pageUrl: string;
	/** Why the page failed. Persisted so the admin console can explain it. */
	error?: unknown;
}): Promise<void> {
	const reason =
		input.error === undefined ? null : (
			formatErrorWithCause(input.error).slice(0, 500)
		);

	await updateScanPageRecord(input.scanId, input.pageUrl, {
		screenshot_desktop_url: null,
		screenshot_mobile_url: null,
		playwright_data: buildPlaywrightIndexPayload(false, reason),
		axe_violations: null,
		raw_html: null,
	});

	slog('warn', 'scan:page_failed_indexed', {
		scanId: input.scanId,
		pageUrl: input.pageUrl,
		reason,
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
		.select('page_url, playwright_data')
		.eq('scan_id', scanId);

	if (error) {
		throw new ScannerError(`Failed to load scan pages: ${error.message}`, 500);
	}

	const rows = (pages ?? []) as Array<{
		page_url: string | null;
		playwright_data: { scanOk?: boolean; failureReason?: string } | null;
	}>;

	const hasSuccessfulPage = rows.some((row) =>
		pageScanSucceeded({ playwright_data: row.playwright_data }),
	);

	const status: ScanStatus = hasSuccessfulPage ? 'analyzing' : 'failed';

	// When every page failed, carry the per-page reasons forward. Without this
	// the scan was marked failed with a flat "All pages failed to scan." and the
	// real cause survived only in the logs.
	const failureDetail =
		status === 'failed' ?
			rows
				.filter((row) => row.playwright_data?.failureReason)
				.map((row) => `${row.page_url ?? 'page'}: ${row.playwright_data!.failureReason}`)
				.join(' | ')
				.slice(0, 1000) || null
		:	null;

	await updateScanStatus(supabase, scanId, {
		status,
		completed_at: status === 'failed' ? nowIso() : null,
		error_message: status === 'failed' ? 'All pages failed to scan.' : null,
		error_detail: failureDetail,
	});

	return status;
}

export async function markScannerFailed(
	supabase: ServiceSupabase,
	scanId: string,
	message: string,
	detail?: string | null,
): Promise<void> {
	slog('error', 'scan:failed', { scanId, error: message, detail });
	try {
		await markScanFailed(supabase, scanId, message, detail);
	} catch (markFailedError: unknown) {
		slog('error', 'scan:mark_failed_error', {
			scanId,
			error: getErrorMessage(markFailedError),
		});
	}
}
