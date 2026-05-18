import { getServiceSupabase } from '@/lib/db/supabase';
import { collectPageSpeedForPages } from '@/lib/utils/savePageSpeedForPage';
import type { ScanPackage } from '@/types/zod';

export async function collectPageSpeedStep(
	scanId: string,
	pagesToTest: string[],
	pkg: ScanPackage,
): Promise<void> {
	const supabase = getServiceSupabase();
	await collectPageSpeedForPages(supabase, scanId, pagesToTest, pkg);
}
