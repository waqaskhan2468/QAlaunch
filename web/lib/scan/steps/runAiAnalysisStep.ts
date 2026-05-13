import { NonRetriableError } from 'inngest';
import { getServiceSupabase } from '@/lib/db/supabase';
import { runAiAnalysisForScan } from '@/lib/claude-scan/runAiAnalysisForScan';
import type { ScanPackage } from '@/types/zod';
import type { ScanRowAfterReload } from './types';

export async function runAiAnalysisStep(input: {
	scanId: string;
	pkg: ScanPackage;
	scanAfter: ScanRowAfterReload;
	pagesToTest: string[];
}): Promise<void> {
	const { scanId, pkg, scanAfter, pagesToTest } = input;
	const supabase = getServiceSupabase();

	if (!process.env.ANTHROPIC_API_KEY) {
		await supabase
			.from('scans')
			.update({
				status: 'failed',
				error_message: 'ANTHROPIC_API_KEY is not configured.',
			})
			.eq('id', scanId);

		throw new NonRetriableError(
			'ANTHROPIC_API_KEY is missing in environment.',
		);
	}

	await runAiAnalysisForScan(
		supabase,
		scanId,
		scanAfter?.website_type ?? null,
		(scanAfter?.pages_to_test as string[] | null) ?? pagesToTest,
		pkg,
	);
}
