import { getServiceSupabase } from '@/lib/db/supabase';
import { AppError } from '@/lib/api/error';
import type { ScanPackage } from '@/types/zod';

export async function markScanDoneStep(input: {
	scanId: string;
	pkg: ScanPackage;
}): Promise<void> {
	const { scanId, pkg } = input;
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
}
