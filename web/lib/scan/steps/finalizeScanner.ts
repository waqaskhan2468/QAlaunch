import { AppError } from '@/lib/api/error';
import {
	finalizeScannerFromDb,
	markScannerFailed,
} from '@/lib/scan/runner';
import type { ScanStatus } from '@/lib/scan/types';

export async function finalizeScannerStep(scanId: string): Promise<ScanStatus> {
	try {
		return await finalizeScannerFromDb(scanId);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'finalize_scanner_failed';
		await markScannerFailed(scanId, message);
		throw new AppError(502, 'scanner_finalize_error', message);
	}
}
