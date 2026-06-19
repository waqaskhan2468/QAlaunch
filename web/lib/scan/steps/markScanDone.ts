import { getServiceSupabase } from '@/lib/db/supabase';
import { AppError } from '@/lib/api/error';
import { logFunnelEvent } from '@/lib/analytics/funnel';
import type { ScanPackage } from '@/types/zod';

export async function markScanDoneStep(input: {
	scanId: string;
	pkg: ScanPackage;
	targetUrl: string;
	userEmail?: string | null;
}): Promise<void> {
	const { scanId, pkg, targetUrl, userEmail } = input;
	const supabase = getServiceSupabase();
	const { error } = await supabase
		.from('scans')
		.update({
			status: 'done',
			completed_at: new Date().toISOString(),
			error_message: null,
			...(pkg === 'free' ? { free_preview_used: true } : {}),
		})
		.eq('id', scanId);

	if (error) {
		throw new AppError(
			500,
			'scan_finalize_failed',
			'Analysis finished but could not mark scan complete.',
		);
	}

	// Funnel: the free-scan pipeline reached its final step. Paid scans are tracked
	// separately (payment_completed) and don't belong in the free drop-off funnel.
	if (pkg === 'free') {
		await logFunnelEvent(supabase, {
			scanId,
			eventType: 'scan_completed',
			url: targetUrl,
			email: userEmail ?? null,
		});
	}
}
