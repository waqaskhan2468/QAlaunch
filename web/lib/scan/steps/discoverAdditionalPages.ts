/**
 * Post-scan page discovery.
 *
 * When the server-side homepage fetch fails (website_type = 'unknown', only 1 page
 * selected), the Playwright browser scan still discovers all internal links via
 * collectLinks(). This step reads those links from the DB after the homepage scan
 * completes and selects additional pages up to the package limit — giving paid
 * standard/premium users their 2–5 / 6–10 page audit even when the server can't
 * directly fetch the homepage HTML.
 */

import { getServiceSupabase } from '@/lib/db/supabase';
import { inferPageRole } from '@/lib/utils/page-selection';
import type { ScanPackage } from '@/types/zod';

// Mirrors getPageLimit() in page-selection.ts — kept local to avoid circular dep.
function packagePageLimit(pkg: ScanPackage): number {
	switch (pkg) {
		case 'free':
		case 'basic':
			return 1;
		case 'standard':
			return 5;
		case 'premium':
			return 10;
		case 'enterprise':
			return 15;
		default:
			return 1;
	}
}

type DiscoveredLink = {
	href: string;
	ok: boolean;
	isExternal: boolean;
	status: number;
};

/**
 * Discover additional pages to scan from the links collected during the
 * homepage Playwright scan.
 *
 * Returns an array of URLs (not including the homepage) up to the remaining
 * package quota, sorted by page role importance.
 * Returns [] if the package quota is already met or no useful links exist.
 */
export async function discoverAdditionalPagesStep(input: {
	scanId: string;
	homepageUrl: string;
	alreadySelectedUrls: string[];
	pkg: ScanPackage;
}): Promise<string[]> {
	const { scanId, homepageUrl, alreadySelectedUrls, pkg } = input;

	const limit = packagePageLimit(pkg);
	const remaining = limit - alreadySelectedUrls.length;

	// Nothing to do — package quota already met
	if (remaining <= 0) return [];

	// Only run for paid packages that get more than 1 page
	if (limit <= 1) return [];

	const supabase = getServiceSupabase();

	const { data: pageRow, error } = await supabase
		.from('scan_pages')
		.select('playwright_data')
		.eq('scan_id', scanId)
		.eq('page_url', homepageUrl)
		.maybeSingle();

	if (error || !pageRow?.playwright_data) {
		console.warn('[discoverAdditionalPages] no playwright_data found', {
			scanId,
			homepageUrl,
		});
		return [];
	}

	const pd = pageRow.playwright_data as Record<string, unknown>;
	const linksBlock = pd?.links as Record<string, unknown> | null;
	const rawLinks = linksBlock?.links as DiscoveredLink[] | null;

	if (!Array.isArray(rawLinks) || rawLinks.length === 0) {
		console.warn('[discoverAdditionalPages] no links in playwright_data', {
			scanId,
			homepageUrl,
		});
		return [];
	}

	const alreadySelected = new Set(alreadySelectedUrls.map((u) => u.toLowerCase()));

	// Filter: internal, reachable (HTTP 200), not already selected
	const candidates = rawLinks
		.filter(
			(link) =>
				link &&
				typeof link.href === 'string' &&
				!link.isExternal &&
				link.ok &&
				link.status === 200 &&
				!alreadySelected.has(link.href.toLowerCase()),
		)
		.map((link) => {
			const role = inferPageRole(link.href, homepageUrl);
			return { href: link.href, role };
		});

	if (candidates.length === 0) return [];

	// Role priority order — same logic as page-selection.ts for 'unknown' type
	const ROLE_PRIORITY = [
		'pricing', 'features', 'product', 'about', 'contact',
		'docs', 'blog', 'work', 'services', 'other', 'legal',
	];

	const roleRank = (role: string) => {
		const idx = ROLE_PRIORITY.indexOf(role);
		return idx === -1 ? 50 : idx;
	};

	// Sort by role importance, deduplicate
	const seen = new Set<string>();
	const sorted = candidates
		.sort((a, b) => roleRank(a.role) - roleRank(b.role))
		.filter((c) => {
			const lower = c.href.toLowerCase();
			if (seen.has(lower)) return false;
			seen.add(lower);
			return true;
		})
		.slice(0, remaining)
		.map((c) => c.href);

	console.log(
		JSON.stringify({
			ts: new Date().toISOString(),
			event: 'discover:additional_pages',
			scanId,
			homepageUrl,
			pkg,
			limit,
			alreadySelected: alreadySelectedUrls.length,
			candidatesFound: candidates.length,
			selected: sorted,
		}),
	);

	return sorted;
}
