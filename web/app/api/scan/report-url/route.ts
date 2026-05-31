import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/db/supabase';
import { createSignedReportDownloadUrl } from '@/lib/report/generateAndStorePdfReport';
import { AppError, asyncHandler } from '@/lib/api/error';

export const runtime = 'nodejs';

/**
 * GET /api/scan/report-url?scanId=xxx
 * Returns a fresh signed download URL for the PDF report.
 * Used by the "Download PDF report" button on the checkout success page.
 */
export const GET = asyncHandler(async (req: Request) => {
	const { searchParams } = new URL(req.url);
	const scanId = searchParams.get('scanId');

	if (!scanId) {
		throw new AppError(400, 'invalid_request', 'scanId is required.');
	}

	const supabase = getServiceSupabase();

	const { data: scan, error } = await supabase
		.from('scans')
		.select('report_pdf_url, payment_status, status')
		.eq('id', scanId)
		.single();

	if (error || !scan) {
		throw new AppError(404, 'not_found', 'Scan not found.');
	}

	if (!scan.report_pdf_url) {
		throw new AppError(404, 'report_not_ready', 'Report is not ready yet.');
	}

	const signedUrl = await createSignedReportDownloadUrl(supabase, scan.report_pdf_url);

	if (!signedUrl) {
		throw new AppError(500, 'sign_failed', 'Could not generate download link. Please try again.');
	}

	// Redirect directly to the signed URL so clicking the link downloads the file.
	return NextResponse.redirect(signedUrl);
});
