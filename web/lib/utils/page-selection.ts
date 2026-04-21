import * as cheerio from 'cheerio';
import type { WebsiteType, ScanPackage } from '@/types/zod';
import {
	extractHrefs,
	resolveUrl,
	isPublicPage,
	dedupe,
} from '@/lib/utils/detect';

// ─────────────────────────────────────────────
// LINK COLLECTION
// ─────────────────────────────────────────────

/**
 * Collects internal, publicly accessible links from nav / header.
 * Falls back to all <a> tags when fewer than 3 nav links are found.
 */
function collectNavLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
	const origin = new URL(baseUrl).origin;

	function toValidPublicUrl(href: string): string | undefined {
		const resolved = resolveUrl(href, baseUrl);
		return resolved && resolved.startsWith(origin) && isPublicPage(resolved) ?
				resolved
			:	undefined;
	}

	const navHrefs = extractHrefs($, 'nav a[href], header a[href]');
	const navLinks = dedupe(navHrefs.map(toValidPublicUrl));

	if (navLinks.length >= 3) return navLinks;

	// Fallback: scan all anchors on the page
	const allHrefs = extractHrefs($, 'a[href]');
	return dedupe(allHrefs.map(toValidPublicUrl));
}

// ─────────────────────────────────────────────
// FINDERS
// ─────────────────────────────────────────────

function findFirst(links: string[], patterns: string[]): string | undefined {
	return links.find((l) => patterns.some((p) => l.toLowerCase().includes(p)));
}

/**
 * Finds up to `limit` product/item page URLs.
 * Uses .reduce() — no .each() / return false.
 */
function findProductPages(
	$: cheerio.CheerioAPI,
	baseUrl: string,
	limit = 3,
): string[] {
	const origin = new URL(baseUrl).origin;
	return extractHrefs($, 'a[href]').reduce<string[]>((acc, href) => {
		if (acc.length >= limit) return acc;
		const resolved = resolveUrl(href, baseUrl);
		if (
			resolved &&
			resolved.startsWith(origin) &&
			isPublicPage(resolved) &&
			/\/products?\/|\/item\//i.test(resolved) &&
			!acc.includes(resolved)
		) {
			acc.push(resolved);
		}
		return acc;
	}, []);
}

/** Finds the first blog post / article URL via semantic selectors. */
function findFirstArticle(
	$: cheerio.CheerioAPI,
	baseUrl: string,
): string | undefined {
	const origin = new URL(baseUrl).origin;
	return extractHrefs($, 'article a[href], .post a[href], .blog a[href]')
		.map((href) => resolveUrl(href, baseUrl))
		.find(
			(resolved): resolved is string =>
				resolved !== undefined &&
				resolved.startsWith(origin) &&
				isPublicPage(resolved),
		);
}

// ─────────────────────────────────────────────
// STANDARD PAGE SELECTION (2–5 pages)
// ─────────────────────────────────────────────

/**
 * Per spec Section 3.3 — Standard Package (2-5 pages).
 *
 * For all types including saas with requiresAuth:
 *   - Public pages only (homepage, pricing, features, about, contact)
 *   - Auth routes NEVER included (isPublicPage filters them)
 */
function selectStandardPages(
	homepageHtml: string,
	baseUrl: string,
	type: WebsiteType,
): string[] {
	const $ = cheerio.load(homepageHtml);
	const navLinks = collectNavLinks($, baseUrl);
	const homepage = new URL('/', baseUrl).toString();
	const pages: (string | undefined)[] = [homepage];

	switch (type) {
		// saas covers both pure marketing SaaS AND webapps (notion, facebook etc.)
		// Per spec: scan public pages — homepage + pricing + features
		case 'saas':
		case 'webapp': // kept for backwards compat if WebsiteType still has it
			pages.push(findFirst(navLinks, ['/features', '/product']));
			pages.push(findFirst(navLinks, ['/pricing']));
			pages.push(findFirst(navLinks, ['/about']));
			pages.push(findFirst(navLinks, ['/contact', '/demo']));
			break;

		case 'ecommerce':
			pages.push(
				findFirst(navLinks, ['/shop', '/products', '/collections', '/store']),
			);
			pages.push(...findProductPages($, baseUrl, 1));
			pages.push(findFirst(navLinks, ['/cart', '/basket']));
			pages.push(findFirst(navLinks, ['/checkout']));
			break;

		case 'business':
			pages.push(findFirst(navLinks, ['/about']));
			pages.push(findFirst(navLinks, ['/services', '/what-we-do']));
			pages.push(findFirst(navLinks, ['/pricing']));
			pages.push(findFirst(navLinks, ['/contact', '/get-quote', '/book']));
			break;

		case 'blog':
			pages.push(findFirst(navLinks, ['/blog', '/posts', '/articles']));
			pages.push(findFirstArticle($, baseUrl));
			pages.push(findFirst(navLinks, ['/about']));
			pages.push(findFirst(navLinks, ['/contact']));
			break;

		case 'portfolio':
			pages.push(
				findFirst(navLinks, [
					'/work',
					'/portfolio',
					'/projects',
					'/case-studies',
				]),
			);
			pages.push(findFirst(navLinks, ['/about']));
			pages.push(findFirst(navLinks, ['/contact']));
			break;

		default:
			// landing / unknown
			pages.push(...navLinks.slice(0, 4));
	}

	return dedupe(pages).slice(0, 5);
}

// ─────────────────────────────────────────────
// PREMIUM PAGE SELECTION (6–10 pages)
// ─────────────────────────────────────────────

/**
 * Per spec Section 3.3 — Premium Package (6-10 pages).
 * Same logic as Standard but wider coverage per category.
 * For eCommerce: 2-3 product pages from different categories.
 * For business: include FAQ, blog index, team pages.
 */
function selectPremiumPages(
	homepageHtml: string,
	baseUrl: string,
	type: WebsiteType,
): string[] {
	const $ = cheerio.load(homepageHtml);
	const navLinks = collectNavLinks($, baseUrl);
	const homepage = new URL('/', baseUrl).toString();
	const pages: (string | undefined)[] = [homepage];

	switch (type) {
		case 'saas':
		case 'webapp':
			pages.push(findFirst(navLinks, ['/features', '/product']));
			pages.push(findFirst(navLinks, ['/pricing']));
			pages.push(findFirst(navLinks, ['/about']));
			pages.push(findFirst(navLinks, ['/contact', '/demo']));
			pages.push(findFirst(navLinks, ['/blog', '/resources', '/changelog']));
			pages.push(findFirst(navLinks, ['/faq', '/help', '/docs']));
			pages.push(findFirst(navLinks, ['/security', '/privacy', '/compliance']));
			break;

		case 'ecommerce':
			pages.push(
				findFirst(navLinks, ['/shop', '/products', '/collections', '/store']),
			);
			// Per spec: 2-3 product pages from different categories
			pages.push(...findProductPages($, baseUrl, 3));
			pages.push(findFirst(navLinks, ['/cart', '/basket']));
			pages.push(findFirst(navLinks, ['/checkout']));
			pages.push(findFirst(navLinks, ['/about']));
			pages.push(findFirst(navLinks, ['/contact', '/faq', '/help']));
			break;

		case 'business':
			pages.push(findFirst(navLinks, ['/about']));
			pages.push(findFirst(navLinks, ['/services', '/what-we-do']));
			pages.push(findFirst(navLinks, ['/pricing']));
			pages.push(findFirst(navLinks, ['/contact', '/get-quote']));
			// Per spec: FAQ, blog index, team pages for business premium
			pages.push(findFirst(navLinks, ['/team', '/our-team']));
			pages.push(findFirst(navLinks, ['/faq']));
			pages.push(findFirst(navLinks, ['/blog', '/news', '/insights']));
			break;

		case 'blog':
			pages.push(findFirst(navLinks, ['/blog', '/posts', '/articles']));
			pages.push(findFirstArticle($, baseUrl));
			pages.push(findFirst(navLinks, ['/about']));
			pages.push(findFirst(navLinks, ['/contact']));
			pages.push(findFirst(navLinks, ['/categories', '/tags', '/topics']));
			pages.push(...navLinks.slice(0, 3));
			break;

		case 'portfolio':
			pages.push(findFirst(navLinks, ['/work', '/portfolio', '/projects']));
			pages.push(findFirst(navLinks, ['/about']));
			pages.push(findFirst(navLinks, ['/contact']));
			pages.push(findFirst(navLinks, ['/services']));
			pages.push(...navLinks.slice(0, 4));
			break;

		default:
			pages.push(...navLinks.slice(0, 9));
	}

	return dedupe(pages).slice(0, 10);
}

// ─────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────

/**
 * Returns the ordered list of URLs to scan for a given package tier.
 *
 * Per spec Section 3.3:
 *   free / basic  → homepage only (1 page)
 *   standard      → 2–5 pages curated by website type
 *   premium       → 6–10 pages curated by website type
 *   enterprise    → [] (manual QA team selects pages)
 *
 * Auth safety: isPublicPage() filters auth routes from every collected link.
 * Login / signup / dashboard pages NEVER appear in the returned list.
 */
export function selectPagesToTest(
	homepageHtml: string,
	baseUrl: string,
	websiteType: WebsiteType,
	pkg: ScanPackage,
): string[] {
	const homepage = new URL('/', baseUrl).toString();

	switch (pkg) {
		case 'free':
		case 'basic':
			return [homepage];

		case 'standard':
			return selectStandardPages(homepageHtml, baseUrl, websiteType);

		case 'premium':
			return selectPremiumPages(homepageHtml, baseUrl, websiteType);

		case 'enterprise':
			// Pages selected manually by QA team
			return [];

		default:
			return [homepage];
	}
}
