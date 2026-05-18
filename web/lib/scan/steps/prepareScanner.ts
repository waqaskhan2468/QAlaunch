import { NonRetriableError } from 'inngest';
import { getServiceSupabase } from '@/lib/db/supabase';
import { prepareScannerScan } from '@/lib/scan/runner';

export async function prepareScannerStep(scanId: string): Promise<void> {
	if (!process.env.BROWSERBASE_API_KEY?.trim()) {
		throw new NonRetriableError('BROWSERBASE_API_KEY is missing.');
	}
	if (!process.env.BROWSERBASE_PROJECT_ID?.trim()) {
		throw new NonRetriableError('BROWSERBASE_PROJECT_ID is missing.');
	}

	const supabase = getServiceSupabase();
	await prepareScannerScan(supabase, scanId);
}
