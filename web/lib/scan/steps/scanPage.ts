import { AppError } from '@/lib/api/error';
import { scanAndPersistPage } from '@/lib/scan/runner';

export async function scanPageStep(input: {
	scanId: string;
	pageUrl: string;
}): Promise<{ ok: boolean }> {
	try {
		return await scanAndPersistPage(input.scanId, input.pageUrl);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'scan_page_failed';
		throw new AppError(502, 'scan_page_error', message);
	}
}
