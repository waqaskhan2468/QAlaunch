import * as cheerio from 'cheerio';
import { NonRetriableError } from 'inngest';
import { fetchHomepageHtml } from '@/lib/api/fetchHomePageHtml';
import { detectWebsiteType } from '@/lib/utils/detect';
import {
	selectPagesToTestWithRoles,
	inferPageRole,
	type SelectedScanPage,
} from '@/lib/utils/page-selection';
import type { ScanPackage } from '@/types/zod';
import type { DetectAndSelectResult } from './types';

// ─── Package limit helper ─────────────────────────────────────────────────────

function getPageLimit(pkg: ScanPackage): number {
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

// ─── Sitemap fallback ─────────────────────────────────────────────────────────

const SITEMAP_TIMEOUT_MS = 10_000;
const SITEMAP_PATHS = ['/sitemap.xml', '/sitemap_index.xml', '/sitemap'];

/**
 * Parse <loc> entries from a sitemap XML string.
 * Same-origin URLs only — skips external, media, and asset URLs.
 */
function parseSitemapUrls(xml: string, baseUrl: string): string[] {
	const base = new URL(baseUrl);
	const seen = new Set<string>();
	const out: string[] = [];

	for (const match of xml.matchAll(/<loc>(.*?)<\/loc>/gi)) {
		const raw = match[1]?.trim();
		if (!raw) continue;

		// Decode HTML entities (&amp; → &)
		const href = raw.replaceAll('&amp;', '&').replaceAll('&#38;', '&');

		try {
			const url = new URL(href);
			if (url.origin !== base.origin) continue;

			// Skip obvious non-page assets
			const ext = url.pathname.split('.').pop()?.toLowerCase() ?? '';
			if (['xml', 'pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'css', 'js'].includes(ext)) continue;

			url.hash = '';
			const normalised = url.toString();

			if (!seen.has(normalised)) {
				seen.add(normalised);
				out.push(normalised);
			}
		} catch {
			continue;
		}
	}

	return out;
}

async function fetchSitemapUrls(baseUrl: string, limit: number): Promise<string[]> {
	for (const path of SITEMAP_PATHS) {
		try {
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), SITEMAP_TIMEOUT_MS);

			const response = await fetch(new URL(path, baseUrl).toString(), {
				signal: controller.signal,
				headers: {
					'User-Agent': 'Mozilla/5.0 (compatible; QALaunch/1.0; +https://qalaunch.com)',
					Accept: 'application/xml,text/xml,*/*',
				},
			});

			clearTimeout(timer);

			if (!response.ok) continue;

			const contentType = response.headers.get('content-type') ?? '';
			if (!contentType.includes('xml') && !contentType.includes('text')) continue;

			const text = await response.text();
			const urls = parseSitemapUrls(text, baseUrl);

			if (urls.length > 0) {
				console.log(
					JSON.stringify({
						ts: new Date().toISOString(),
						event: 'detect:sitemap_fallback_success',
						baseUrl,
						sitemapPath: path,
						foundUrls: urls.length,
						limit,
					}),
				);
				return urls.slice(0, limit);
			}
		} catch {
			continue;
		}
	}

	return [];
}

/**
 * Build a DetectAndSelectResult from sitemap-discovered URLs.
 * We don't have HTML so we can't detect website type — use 'unknown'
 * and infer page roles from URL paths.
 */
function buildSitemapFallback(
	targetUrl: string,
	sitemapUrls: string[],
	pkg: ScanPackage,
): DetectAndSelectResult {
	const homepageUrl = new URL('/', targetUrl).toString();
	const limit = getPageLimit(pkg);

	// Ensure homepage is first
	const uniqueUrls = [
		homepageUrl,
		...sitemapUrls.filter((u) => u !== homepageUrl),
	].slice(0, limit);

	const selectedPages: SelectedScanPage[] = uniqueUrls.map((url) => ({
		url,
		role: inferPageRole(url, targetUrl),
	}));

	console.warn(
		JSON.stringify({
			ts: new Date().toISOString(),
			level: 'warn',
			event: 'detect:sitemap_fallback',
			targetUrl,
			pkg,
			pagesSelected: selectedPages.length,
			reason: 'Homepage HTML fetch failed; pages discovered via sitemap.xml.',
		}),
	);

	return {
		detection: { type: 'unknown', requiresAuth: false },
		pagesToTest: selectedPages.map((p) => p.url),
		selectedPages,
	};
}

// ─── Homepage-only fallback ───────────────────────────────────────────────────

/** Last resort: scan homepage only via Browserbase when nothing else works. */
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
			reason: 'Server could not fetch homepage HTML or sitemap; scanning homepage only via browser.',
		}),
	);

	return {
		detection: { type: 'unknown', requiresAuth: false },
		pagesToTest: selectedPages.map((p) => p.url),
		selectedPages,
	};
}

// ─── Main step ────────────────────────────────────────────────────────────────

export async function detectAndSelectPagesStep(
	targetUrl: string,
	pkg: ScanPackage,
): Promise<DetectAndSelectResult> {
	let html: string | null = null;

	try {
		html = await fetchHomepageHtml(targetUrl);
	} catch {
		// Server-side fetch failed — fall through to sitemap/homepage fallbacks below
	}

	if (!html) {
		const limit = getPageLimit(pkg);

		// For paid packages that expect more than 1 page, try sitemap discovery.
		if (limit > 1) {
			const sitemapUrls = await fetchSitemapUrls(targetUrl, limit);
			if (sitemapUrls.length > 0) {
				return buildSitemapFallback(targetUrl, sitemapUrls, pkg);
			}
		}

		return buildHomepageFetchFallback(targetUrl);
	}

	// ── Normal path: HTML fetched successfully ────────────────────────────────
	// Parse once — pass the same CheerioAPI instance to both functions so the
	// HTML string is not loaded into the DOM twice.
	const $ = cheerio.load(html);

	const detection = detectWebsiteType(html, targetUrl, $);
	const selectedPages = selectPagesToTestWithRoles(
		html,
		targetUrl,
		detection.type,
		pkg,
		$,
	);

	return {
		detection,
		pagesToTest: selectedPages.map((p) => p.url),
		selectedPages,
	};
}
