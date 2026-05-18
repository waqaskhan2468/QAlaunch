import { getServiceSupabase } from '@/lib/db/supabase';
import { AppError } from '@/lib/api/error';
import type { DetectionResult } from '@/lib/utils/detect';
import type { SelectedScanPage } from '@/lib/utils/page-selection';

export async function persistScanMetadataStep(input: {
	scanId: string;
	detection: DetectionResult;
	pagesToTest: string[];
	selectedPages: SelectedScanPage[];
}): Promise<void> {
	const { scanId, detection, pagesToTest, selectedPages } = input;
	const supabase = getServiceSupabase();

	const { error: scanUpdateError } = await supabase
		.from('scans')
		.update({
			website_type: detection.type,
			pages_to_test: pagesToTest,
			status: 'crawling',
			error_message: null,
		})
		.eq('id', scanId);

	if (scanUpdateError) {
		console.error('[persist-metadata] scan update error', {
			scanId,
			code: scanUpdateError.code,
			message: scanUpdateError.message,
			details: scanUpdateError.details,
			hint: scanUpdateError.hint,
		});
		throw new AppError(
			500,
			'scan_update_failed',
			'Failed to save scan metadata.',
		);
	}

	const { error: upsertPagesError } = await supabase.from('scan_pages').upsert(
		selectedPages.map((p: SelectedScanPage) => ({
			scan_id: scanId,
			page_url: p.url,
			page_role: p.role,
		})),
		{ onConflict: 'scan_id,page_url' },
	);

	if (upsertPagesError) {
		console.error('[persist-metadata] scan_pages upsert error', {
			scanId,
			code: upsertPagesError.code,
			message: upsertPagesError.message,
			details: upsertPagesError.details,
			hint: upsertPagesError.hint,
		});
		throw new AppError(
			500,
			'scan_pages_prepare_failed',
			'Could not prepare pages for scanning.',
		);
	}
}
