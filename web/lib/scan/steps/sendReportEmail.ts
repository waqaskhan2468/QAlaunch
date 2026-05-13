import { getServiceSupabase } from '@/lib/db/supabase';
import {
	createSignedReportDownloadUrl,
	sendReportEmail,
} from '@/lib/report/generateAndStorePdfReport';

export async function sendReportEmailStep(input: {
	scanId: string;
	report: {
		pdfStoragePath: string;
		userEmail: string | null;
		targetUrl: string;
	};
}): Promise<void> {
	const { scanId, report } = input;
	const supabase = getServiceSupabase();

	const pdfUrl = await createSignedReportDownloadUrl(
		supabase,
		report.pdfStoragePath,
	);

	if (!pdfUrl) {
		console.error('[run-scan] signed URL generation failed — skipping email', {
			scanId,
			pdfStoragePath: report.pdfStoragePath,
		});
		return;
	}

	try {
		await sendReportEmail({
			to: report.userEmail,
			scanId,
			targetUrl: report.targetUrl,
			pdfUrl,
		});
	} catch (err) {
		console.error('[run-scan] report email failed — continuing', {
			scanId,
			error: err instanceof Error ? err.message : err,
		});
	}
}
