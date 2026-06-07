import { getServiceSupabase } from '@/lib/db/supabase';
import { savePageSpeedForPage } from '@/lib/utils/savePageSpeedForPage';
import type { ScanPackage } from '@/types/zod';

export async function collectPageSpeedForPageStep(
	scanId: string,
	pageUrl: string,
	pkg: ScanPackage,
): Promise<void> {
	const supabase = getServiceSupabase();
	await savePageSpeedForPage(supabase, scanId, pageUrl, pkg);
}
