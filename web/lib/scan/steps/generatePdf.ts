import { getServiceSupabase } from '@/lib/db/supabase';
import { generateAndStorePdfReport } from '@/lib/report/generateAndStorePdfReport';

export async function generatePdfStep(scanId: string) {
	const supabase = getServiceSupabase();
	return generateAndStorePdfReport(supabase, scanId);
}
