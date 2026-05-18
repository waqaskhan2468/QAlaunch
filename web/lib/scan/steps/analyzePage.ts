import { NonRetriableError } from 'inngest';
import { analyzeScanPageWithClaude } from '@/lib/scan/ai';
import { toUserFacingScanError } from '@/lib/scan/fail-scan';
import { getServiceSupabase } from '@/lib/db/supabase';
import type { ScanPackage } from '@/types/zod';

export async function analyzePageStep(input: {
	scanId: string;
	pageUrl: string;
	websiteType: string | null;
	pkg: ScanPackage;
}): Promise<void> {
	if (!process.env.ANTHROPIC_API_KEY) {
		throw new NonRetriableError('ANTHROPIC_API_KEY is missing in environment.');
	}

	const supabase = getServiceSupabase();

	try {
		await analyzeScanPageWithClaude(
			supabase,
			input.scanId,
			input.pageUrl,
			input.websiteType,
			input.pkg,
		);
	} catch (error: unknown) {
		throw new NonRetriableError(toUserFacingScanError(error));
	}
}
