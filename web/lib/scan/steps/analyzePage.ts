import { NonRetriableError } from 'inngest';
import { AppError } from '@/lib/api/error';
import { analyzeScanPageWithClaude } from '@/lib/scan/ai';
import { getServiceSupabase } from '@/lib/db/supabase';

export async function analyzePageStep(input: {
	scanId: string;
	pageUrl: string;
	websiteType: string | null;
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
		);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'ai_page_failed';
		throw new AppError(502, 'ai_page_error', message);
	}
}
