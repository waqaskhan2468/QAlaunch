import { NonRetriableError } from 'inngest';
import { getServiceSupabase } from '@/lib/db/supabase';
import { persistScanIssuesFromAnalysis } from '@/lib/scan/ai';
import { toUserFacingScanError } from '@/lib/scan/fail-scan';
import type { ScanPackage } from '@/types/zod';

export async function persistAiIssuesStep(input: {
	scanId: string;
	pkg: ScanPackage;
	pagesToTest: string[];
	sourceScanId?: string | null;
}): Promise<void> {
	const supabase = getServiceSupabase();
	try {
		await persistScanIssuesFromAnalysis(
			supabase,
			input.scanId,
			input.pagesToTest,
			input.pkg,
			{ sourceScanId: input.sourceScanId ?? null },
		);
	} catch (error: unknown) {
		throw new NonRetriableError(toUserFacingScanError(error));
	}
}
