import * as cheerio from 'cheerio';
import type { WebsiteType, ScanPackage } from '@/types/zod';
import {
	extractHrefs,
	resolveUrl,
	isPublicPage,
	dedupe,
} from '@/lib/utils/detect';

// ─────────────────────────────────────────────
// LINK COLLECTION + NORMALIZATION
// ─────────────────────────────────────────────

const AUTH_KEYWORDS = [
	'login',
	'log-in',
	'signin',
	'sign-in',
	'signup',
	'sign-up',
	'register',
	'auth',
	'account',
	'dashboard',
	'settings',
	'logout',
	'profile',
	'my-account',
];

function hasAuthKeyword(url: URL): boolean {
	const haystack = `${url.pathname}${url.search}${url.hash}`.toLowerCase();
	return AUTH_KEYWORDS.some((k) => haystack.includes(k));
}

function normalizeInternalPublicUrl(
	href: string | undefined,
	baseUrl: string,
): string | undefined {
	const resolved = resolveUrl(href, baseUrl);
	if (!resolved) return undefined;

	const base = new URL(baseUrl);
	const u = new URL(resolved);

	if (u.origin !== base.origin) return undefined;
	if (!isPublicPage(u.toString())) return undefined;
	if (hasAuthKeyword(u)) return undefined;

	u.hash = '';

	let out = u.toString();
	if (u.pathname !== '/' && out.endsWith('/')) {
		out = out.slice(0, -1);
	}
	return out;
}

/**
 * Collect internal, public links from nav/header first.
 * Fallback to all anchors if nav is too sparse.
 */
function collectNavLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
	const navHrefs = extractHrefs($, 'nav a[href], header a[href]');
	const navLinks = dedupe(
		navHrefs.map((href) => normalizeInternalPublicUrl(href, baseUrl)),
	);

	if (navLinks.length >= 3) return navLinks;

	const allHrefs = extractHrefs($, 'a[href]');
	return dedupe(
		allHrefs.map((href) => normalizeInternalPublicUrl(href, baseUrl)),
	);
}

function collectAllPublicLinks(
	$: cheerio.CheerioAPI,
	baseUrl: string,
): string[] {
	const hrefs = extractHrefs($, 'a[href]');
	return dedupe(hrefs.map((href) => normalizeInternalPublicUrl(href, baseUrl)));
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function findFirst(links: string[], patterns: string[]): string | undefined {
	return links.find((l) => patterns.some((p) => l.toLowerCase().includes(p)));
}

function findProductPages(
	$: cheerio.CheerioAPI,
	baseUrl: string,
	limit = 3,
): string[] {
	const origin = new URL(baseUrl).origin;
	return extractHrefs($, 'a[href]').reduce<string[]>((acc, href) => {
		if (acc.length >= limit) return acc;

		const normalized = normalizeInternalPublicUrl(href, baseUrl);
		if (!normalized) return acc;
		if (!normalized.startsWith(origin)) return acc;

		if (
			/\/products?\/|\/item\/|\/collections\/|\/shop\//i.test(normalized) &&
			!acc.includes(normalized)
		) {
			acc.push(normalized);
		}
		return acc;
	}, []);
}

function findFirstArticle(
	$: cheerio.CheerioAPI,
	baseUrl: string,
): string | undefined {
	return extractHrefs($, 'article a[href], .post a[href], .blog a[href]')
		.map((href) => normalizeInternalPublicUrl(href, baseUrl))
		.find((url): url is string => Boolean(url));
}

function scoreUrl(url: string): number {
	const l = url.toLowerCase();
	let score = 0;

	if (l.includes('/pricing')) score += 100;
	if (
		l.includes('/product') ||
		l.includes('/features') ||
		l.includes('/solutions')
	)
		score += 90;
	if (
		l.includes('/docs') ||
		l.includes('/documentation') ||
		l.includes('/help') ||
		l.includes('/faq')
	)
		score += 80;
	if (
		l.includes('/security') ||
		l.includes('/privacy') ||
		l.includes('/compliance')
	)
		score += 70;
	if (
		l.includes('/about') ||
		l.includes('/company') ||
		l.includes('/team') ||
		l.includes('/services')
	)
		score += 60;
	if (
		l.includes('/blog') ||
		l.includes('/resources') ||
		l.includes('/news') ||
		l.includes('/insights') ||
		l.includes('/changelog')
	)
		score += 50;
	if (l.includes('/contact') || l.includes('/demo')) score += 40;

	const depth = new URL(url).pathname.split('/').filter(Boolean).length;
	score -= Math.max(0, depth - 2) * 5;

	return score;
}

function rankLinks(links: string[]): string[] {
	return [...links].sort((a, b) => scoreUrl(b) - scoreUrl(a));
}

function mergeUnique(
	base: (string | undefined)[],
	extras: string[],
	maxCount: number,
): string[] {
	const merged = dedupe(base).filter(Boolean);
	for (const link of extras) {
		if (merged.length >= maxCount) break;
		if (!merged.includes(link)) merged.push(link);
	}
	return merged.slice(0, maxCount);
}

// ─────────────────────────────────────────────
// TYPE-BASED STANDARD (2–5)
// ─────────────────────────────────────────────

function selectStandardPages(
	homepageHtml: string,
	baseUrl: string,
	type: WebsiteType,
): string[] {
	const $ = cheerio.load(homepageHtml);
	const navLinks = collectNavLinks($, baseUrl);
	const allPublic = collectAllPublicLinks($, baseUrl);
	const homepage = new URL('/', baseUrl).toString();

	const curated: (string | undefined)[] = [homepage];

	switch (type) {
		case 'saas':
		case 'webapp':
			curated.push(
				findFirst(navLinks, ['/features', '/product', '/solutions']),
			);
			curated.push(findFirst(navLinks, ['/pricing']));
			curated.push(findFirst(navLinks, ['/about', '/company']));
			curated.push(findFirst(navLinks, ['/contact', '/demo']));
			break;

		case 'ecommerce':
			curated.push(
				findFirst(navLinks, ['/shop', '/products', '/collections', '/store']),
			);
			curated.push(...findProductPages($, baseUrl, 1));
			curated.push(findFirst(navLinks, ['/cart', '/basket']));
			curated.push(findFirst(navLinks, ['/checkout']));
			break;

		case 'business':
			curated.push(findFirst(navLinks, ['/about', '/company']));
			curated.push(findFirst(navLinks, ['/services', '/what-we-do']));
			curated.push(findFirst(navLinks, ['/pricing']));
			curated.push(findFirst(navLinks, ['/contact', '/get-quote', '/book']));
			break;

		case 'blog':
			curated.push(findFirst(navLinks, ['/blog', '/posts', '/articles']));
			curated.push(findFirstArticle($, baseUrl));
			curated.push(findFirst(navLinks, ['/about']));
			curated.push(findFirst(navLinks, ['/contact']));
			break;

		case 'portfolio':
			curated.push(
				findFirst(navLinks, [
					'/work',
					'/portfolio',
					'/projects',
					'/case-studies',
				]),
			);
			curated.push(findFirst(navLinks, ['/about', '/team']));
			curated.push(findFirst(navLinks, ['/contact']));
			curated.push(findFirst(navLinks, ['/services']));
			break;

		default:
			curated.push(...navLinks.slice(0, 4));
	}

	const fallbackPool = rankLinks(
		allPublic.filter((u) => u !== homepage && !dedupe(curated).includes(u)),
	);

	return mergeUnique(curated, fallbackPool, 5);
}

// ─────────────────────────────────────────────
// TYPE-BASED PREMIUM (6–10)
// ─────────────────────────────────────────────

function selectPremiumPages(
	homepageHtml: string,
	baseUrl: string,
	type: WebsiteType,
): string[] {
	const $ = cheerio.load(homepageHtml);
	const navLinks = collectNavLinks($, baseUrl);
	const allPublic = collectAllPublicLinks($, baseUrl);
	const homepage = new URL('/', baseUrl).toString();

	const curated: (string | undefined)[] = [homepage];

	switch (type) {
		case 'saas':
		case 'webapp':
			curated.push(
				findFirst(navLinks, ['/features', '/product', '/solutions']),
			);
			curated.push(findFirst(navLinks, ['/pricing']));
			curated.push(findFirst(navLinks, ['/about', '/company']));
			curated.push(findFirst(navLinks, ['/contact', '/demo']));
			curated.push(findFirst(navLinks, ['/docs', '/help', '/resources']));
			curated.push(findFirst(navLinks, ['/blog', '/changelog']));
			curated.push(
				findFirst(navLinks, ['/security', '/privacy', '/compliance']),
			);
			break;

		case 'ecommerce':
			curated.push(
				findFirst(navLinks, ['/shop', '/products', '/collections', '/store']),
			);
			// Premium: 2-3 product pages
			curated.push(...findProductPages($, baseUrl, 3));
			curated.push(findFirst(navLinks, ['/cart', '/basket']));
			curated.push(findFirst(navLinks, ['/checkout']));
			curated.push(findFirst(navLinks, ['/about']));
			curated.push(findFirst(navLinks, ['/contact', '/faq', '/help']));
			break;

		case 'business':
			curated.push(findFirst(navLinks, ['/about', '/company']));
			curated.push(findFirst(navLinks, ['/services', '/what-we-do']));
			curated.push(findFirst(navLinks, ['/pricing']));
			curated.push(findFirst(navLinks, ['/contact', '/get-quote', '/book']));
			// Premium additions requested by spec
			curated.push(findFirst(navLinks, ['/team', '/our-team']));
			curated.push(findFirst(navLinks, ['/faq']));
			curated.push(findFirst(navLinks, ['/blog', '/news', '/insights']));
			break;

		case 'blog':
			curated.push(findFirst(navLinks, ['/blog', '/posts', '/articles']));
			curated.push(findFirstArticle($, baseUrl));
			curated.push(findFirst(navLinks, ['/about']));
			curated.push(findFirst(navLinks, ['/contact']));
			curated.push(findFirst(navLinks, ['/categories', '/tags', '/topics']));
			curated.push(...navLinks.slice(0, 3));
			break;

		case 'portfolio':
			curated.push(findFirst(navLinks, ['/work', '/portfolio', '/projects']));
			curated.push(findFirst(navLinks, ['/about', '/team']));
			curated.push(findFirst(navLinks, ['/contact']));
			curated.push(findFirst(navLinks, ['/services']));
			curated.push(findFirst(navLinks, ['/case-studies', '/testimonials']));
			curated.push(...navLinks.slice(0, 4));
			break;

		default:
			curated.push(...navLinks.slice(0, 9));
	}

	const fallbackPool = rankLinks(
		allPublic.filter((u) => u !== homepage && !dedupe(curated).includes(u)),
	);

	return mergeUnique(curated, fallbackPool, 10);
}

// ─────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────

/**
 * free/basic   => homepage only
 * standard     => 2-5 pages, type-based + fallback fill
 * premium      => 6-10 pages, wider type-based + fallback fill
 * enterprise   => [] (manual QA team selection)
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
			return [];

		default:
			return [homepage];
	}
}
