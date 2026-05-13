import { getServiceSupabase } from '@/lib/db/supabase';
import { AppError } from '@/lib/api/error';

export async function markCrawlingStep(scanId: string): Promise<void> {
	const supabase = getServiceSupabase();
	const { error } = await supabase
		.from('scans')
		.update({ status: 'crawling', error_message: null })
		.eq('id', scanId);

	if (error) {
		console.error('[run-scan] mark-crawling supabase error', {
			scanId,
			message: error.message,
			code: error.code,
			details: error.details,
		});
		throw new AppError(
			500,
			'scan_status_update_failed',
			'Could not mark scan as crawling.',
		);
	}
}
