import { NonRetriableError } from 'inngest';
import { fetchHomepageHtml } from '@/lib/api/fetchHomePageHtml';
import { detectWebsiteType } from '@/lib/utils/detect';
import {
	selectPagesToTestWithRoles,
	type SelectedScanPage,
} from '@/lib/utils/page-selection';
import type { ScanPackage } from '@/types/zod';
import type { DetectAndSelectResult } from './types';

/** When server-side fetch cannot reach the site, still scan homepage via Browserbase. */
function buildHomepageFetchFallback(targetUrl: string): DetectAndSelectResult {
	const homepageUrl = new URL('/', targetUrl).toString();
	const selectedPages: SelectedScanPage[] = [
		{ url: homepageUrl, role: 'homepage' },
	];

	console.warn(
		JSON.stringify({
			ts: new Date().toISOString(),
			level: 'warn',
			event: 'detect:homepage_fetch_fallback',
			targetUrl,
			homepageUrl,
			reason: 'Server could not fetch homepage HTML; scanning homepage only via browser.',
		}),
	);

	return {
		detection: { type: 'other' as const, requiresAuth: false },
		pagesToTest: selectedPages.map((p) => p.url),
		selectedPages,
	};
}

export async function detectAndSelectPagesStep(
	targetUrl: string,
	pkg: ScanPackage,
): Promise<DetectAndSelectResult> {
	let html: string | null = null;

	try {
		html = await fetchHomepageHtml(targetUrl);
	} catch {
		return buildHomepageFetchFallback(targetUrl);
	}

	if (!html) {
		return buildHomepageFetchFallback(targetUrl);
	}

	const detection = detectWebsiteType(html ?? '', targetUrl);
	const selectedPages = selectPagesToTestWithRoles(html ?? '', targetUrl, detection.type, pkg);

	return {
		detection,
		pagesToTest: selectedPages.map((p) => p.url),
		selectedPages,
	};
}
