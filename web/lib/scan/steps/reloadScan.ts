import { getServiceSupabase } from '@/lib/db/supabase';
import { AppError } from '@/lib/api/error';
import type { ScanRowAfterReload } from './types';

export async function reloadScanStep(scanId: string): Promise<ScanRowAfterReload> {
	const supabase = getServiceSupabase();
	const { data, error } = await supabase
		.from('scans')
		.select('status, website_type, pages_to_test, package')
		.eq('id', scanId)
		.single();

	if (error) {
		throw new AppError(
			500,
			'scan_reload_failed',
			'Could not reload scan after collection.',
		);
	}

	return data as ScanRowAfterReload;
}
