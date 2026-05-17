import { getServiceSupabase } from '@/lib/db/supabase';
import { persistScanIssuesFromAnalysis } from '@/lib/scan/ai';
import type { ScanPackage } from '@/types/zod';

export async function persistAiIssuesStep(input: {
	scanId: string;
	pkg: ScanPackage;
	pagesToTest: string[];
}): Promise<void> {
	const supabase = getServiceSupabase();
	await persistScanIssuesFromAnalysis(
		supabase,
		input.scanId,
		input.pagesToTest,
		input.pkg,
	);
}
