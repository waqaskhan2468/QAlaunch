import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/db/supabase';
import { queueScanJob } from '@/lib/api/queue-scan-job';
import { AppError, asyncHandler } from '@/lib/api/error';

export const runtime = 'nodejs';

/**
 * POST /api/scan/retry
 * Re-fires the Inngest pipeline for a paid scan that failed.
 * No new charge — validates payment_status = 'paid' before allowing retry.
 *
 * Body: { scanId: string }
 */
export const POST = asyncHandler(async (req: Request) => {
	const body = await req.json() as { scanId?: string };
	const { scanId } = body;

	if (!scanId || typeof scanId !== 'string') {
		throw new AppError(400, 'invalid_request', 'scanId is required.');
	}

	const supabase = getServiceSupabase();

	const { data: scan, error } = await supabase
		.from('scans')
		.select('id, url, package, status, payment_status, user_email')
		.eq('id', scanId)
		.single();

	if (error || !scan) {
		throw new AppError(404, 'not_found', 'Scan not found.');
	}

	// Only paid scans can retry — free scans must start a new scan.
	if (scan.payment_status !== 'paid') {
		throw new AppError(
			403,
			'not_paid',
			'Only paid scans can be retried. Please start a new free scan.',
		);
	}

	// Only failed or stuck scans should be retried.
	if (scan.status !== 'failed' && scan.status !== 'pending') {
		throw new AppError(
			409,
			'scan_not_failed',
			`Scan is currently "${scan.status}" — retry is only available for failed scans.`,
		);
	}

	// Reset scan status to pending so the pipeline restarts cleanly.
	const { error: updateError } = await supabase
		.from('scans')
		.update({
			status: 'pending',
			error_message: null,
			completed_at: null,
			report_pdf_url: null,
		})
		.eq('id', scanId);

	if (updateError) {
		throw new AppError(500, 'update_failed', 'Could not reset scan status.');
	}

	// Re-fire the Inngest pipeline — same scanId, no new charge.
	await queueScanJob({
		scanId: scan.id,
		targetUrl: scan.url,
		package: scan.package,
		userEmail: scan.user_email ?? null,
	});

	return NextResponse.json({ ok: true, scanId: scan.id });
});
