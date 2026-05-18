import { AppError } from '@/lib/api/error';
import { getServiceSupabase } from '@/lib/db/supabase';
import {
	finalizeScannerFromDb,
	markScannerFailed,
} from '@/lib/scan/runner';
import type { ScanStatus } from '@/types/zod';

export async function finalizeScannerStep(scanId: string): Promise<ScanStatus> {
	const supabase = getServiceSupabase();
	try {
		return await finalizeScannerFromDb(supabase, scanId);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'finalize_scanner_failed';
		await markScannerFailed(supabase, scanId, message);
		throw new AppError(502, 'scanner_finalize_error', message);
	}
}
