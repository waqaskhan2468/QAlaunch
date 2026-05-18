import { NonRetriableError } from 'inngest';
import { getServiceSupabase } from '@/lib/db/supabase';
import { failScan, toUserFacingScanError } from '@/lib/scan/fail-scan';
import { scanAndPersistPage } from '@/lib/scan/runner';

export async function scanPageStep(input: {
	scanId: string;
	pageUrl: string;
}): Promise<{ ok: boolean }> {
	const supabase = getServiceSupabase();
	try {
		return await scanAndPersistPage(supabase, input.scanId, input.pageUrl);
	} catch (error: unknown) {
		await failScan(supabase, input.scanId, error);
		throw new NonRetriableError(toUserFacingScanError(error));
	}
}
