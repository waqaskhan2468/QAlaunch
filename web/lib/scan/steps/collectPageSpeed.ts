import { getServiceSupabase } from '@/lib/db/supabase';
import { collectPageSpeedForPages } from '@/lib/utils/savePageSpeedForPage';

export async function collectPageSpeedStep(
	scanId: string,
	pagesToTest: string[],
): Promise<void> {
	const supabase = getServiceSupabase();
	await collectPageSpeedForPages(supabase, scanId, pagesToTest);
}
