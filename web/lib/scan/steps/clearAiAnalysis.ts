import { getServiceSupabase } from '@/lib/db/supabase';
import { clearScanIssuesForAnalysis } from '@/lib/scan/ai';

export async function clearAiAnalysisStep(scanId: string): Promise<void> {
	const supabase = getServiceSupabase();
	await clearScanIssuesForAnalysis(supabase, scanId);
}
