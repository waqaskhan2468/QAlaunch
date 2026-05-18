import { runPageSpeedForUrl } from '@/lib/api/pagespeed';
import type { PageSpeedStrategy } from '@/lib/api/pagespeed.types';
import { getServiceSupabase } from '@/lib/db/supabase';
import type { ScanPackage } from '@/types/zod';

const FREE_PAGESPEED_TIMEOUT_MS = 45_000;
const FREE_PAGESPEED_STRATEGIES: PageSpeedStrategy[] = ['mobile'];

function getPageSpeedConcurrency(): number {
	const raw = Number.parseInt(process.env.PAGESPEED_CONCURRENCY ?? '', 10);
	return Number.isFinite(raw) && raw >= 1 ? raw : 3;
}

const PAGESPEED_CONCURRENCY = getPageSpeedConcurrency();
const PAGE_SPEED_DB_RETRIES = 2;
const PAGE_SPEED_DB_RETRY_DELAY_MS = 1_000;

type SupabaseClient = ReturnType<typeof getServiceSupabase>;

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function updatePageSpeedData(
	supabase: SupabaseClient,
	scanId: string,
	pageUrl: string,
	pageSpeedData: unknown,
): Promise<void> {
	const { error } = await supabase
		.from('scan_pages')
		.update({ page_speed_data: pageSpeedData })
		.eq('scan_id', scanId)
		.eq('page_url', pageUrl);

	if (error) {
		throw new Error(error.message);
	}
}

async function updatePageSpeedDataWithRetry(
	supabase: SupabaseClient,
	scanId: string,
	pageUrl: string,
	pageSpeedData: unknown,
): Promise<void> {
	let lastError = 'unknown_error';

	for (let attempt = 1; attempt <= PAGE_SPEED_DB_RETRIES + 1; attempt += 1) {
		try {
			await updatePageSpeedData(supabase, scanId, pageUrl, pageSpeedData);
			return;
		} catch (error) {
			lastError = getErrorMessage(error);

			if (attempt <= PAGE_SPEED_DB_RETRIES) {
				await sleep(PAGE_SPEED_DB_RETRY_DELAY_MS * attempt);
			}
		}
	}

	console.error('[process] page_speed db update failed', {
		scanId,
		pageUrl,
		error: lastError,
	});
	
  throw new Error(
    `Failed to persist page speed data after ${PAGE_SPEED_DB_RETRIES + 1} attempts for ${pageUrl}: ${lastError}`,
  );
}


function pageSpeedOptionsForPackage(pkg: ScanPackage) {
	if (pkg === 'free') {
		return {
			timeoutMs: FREE_PAGESPEED_TIMEOUT_MS,
			strategies: FREE_PAGESPEED_STRATEGIES,
		};
	}
	return undefined;
}

export async function savePageSpeedForPage(
	supabase: SupabaseClient,
	scanId: string,
	pageUrl: string,
	pkg: ScanPackage,
): Promise<void> {
	const pageSpeedData = await runPageSpeedForUrl(
		pageUrl,
		pageSpeedOptionsForPackage(pkg),
	);

	await updatePageSpeedDataWithRetry(supabase, scanId, pageUrl, pageSpeedData);
}

export async function collectPageSpeedForPages(
	supabase: SupabaseClient,
	scanId: string,
	pageUrls: string[],
	pkg: ScanPackage,
): Promise<void> {
	for (let index = 0; index < pageUrls.length; index += PAGESPEED_CONCURRENCY) {
		const chunk = pageUrls.slice(index, index + PAGESPEED_CONCURRENCY);

		await Promise.all(
			chunk.map((pageUrl) =>
				savePageSpeedForPage(supabase, scanId, pageUrl, pkg),
			),
		);
	}
}
