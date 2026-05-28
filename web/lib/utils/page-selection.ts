import * as cheerio from 'cheerio';
import type { WebsiteType, ScanPackage } from '@/types/zod';
import { resolveUrl, isPublicPage, dedupe, AUTH_KEYWORDS } from './detect';

export type PageRole =
	| 'homepage'
	| 'pricing'
	| 'features'
	| 'product'
	| 'cart'
	| 'checkout'
	| 'about'
	| 'contact'
	| 'docs'
	| 'blog'
	| 'legal'
	// ── New roles ────────────────────────────────────────────────────────────
	| 'work'      // portfolio / case studies (agency, freelancer)
	| 'services'  // services / what-we-do page (agency, business)
	| 'menu'      // restaurant food menu
	| 'team'      // team / people page
	| 'donate'    // donate / give page (nonprofit)
	| 'speakers'  // event speakers list
	| 'listings'  // directory / search listings
	| 'other';

export type SelectedScanPage = {
	url: string;
	role: PageRole;
};

type LinkCandidate = {
	url: string;
	text: string;
	isNav: boolean;
	role: PageRole;
	score: number;
};

// AUTH_KEYWORDS is imported from detect.ts — single source of truth.

const ROLE_PATTERNS: Record<PageRole, string[]> = {
	homepage: [],
	pricing:  ['pricing', 'plans', 'packages'],
	features: ['features', 'solutions', 'platform', 'use-cases', 'storage'],
	product: [
		'product',
		'products',
		'item',
		'shop',
		'store',
		'collections',
		'catalog',
	],
	cart:     ['cart', 'basket'],
	checkout: ['checkout'],
	about:    ['about', 'company', 'team', 'who-we-are', 'customers'],
	contact:  ['contact', 'demo', 'quote', 'book', 'get-in-touch', 'sales'],
	docs:     ['docs', 'documentation', 'help', 'faq', 'support'],
	blog:     ['blog', 'posts', 'articles', 'resources', 'news', 'insights'],
	legal:    ['privacy', 'terms', 'security', 'compliance'],
	// New roles
	work:     ['work', 'portfolio', 'projects', 'case-studies', 'casestudies', 'selected'],
	services: ['services', 'what-we-do', 'our-services', 'service'],
	menu:     ['menu', 'food', 'drinks', 'cuisine', 'our-menu'],
	team:     ['team', 'people', 'meet-us', 'crew', 'staff', 'meet-the-team'],
	donate:   ['donate', 'give', 'support-us', 'fundraising', 'donation'],
	speakers: ['speakers', 'speaker'],
	listings: ['listings', 'listing', 'directory', 'browse', 'search'],
	other:    [],
};

const ROLE_PRIORITY: Record<WebsiteType, PageRole[]> = {
	ecommerce: [
		'homepage',
		'product',
		'cart',
		'checkout',
		'about',
		'contact',
		'docs',
		'blog',
		'legal',
		'other',
	],
	saas: [
		'homepage',
		'features',
		'pricing',
		'contact',
		'docs',
		'blog',
		'legal',
		'about',
		'other',
	],
	webapp: [
		'homepage',
		'features',
		'pricing',
		'docs',
		'contact',
		'legal',
		'about',
		'blog',
		'other',
	],
	business: [
		'homepage',
		'about',
		'services',
		'contact',
		'pricing',
		'features',
		'blog',
		'docs',
		'legal',
		'other',
	],
	blog: ['homepage', 'blog', 'about', 'contact', 'docs', 'legal', 'other'],
	portfolio: [
		'homepage',
		'work',
		'about',
		'contact',
		'blog',
		'other',
	],
	landing: ['homepage', 'features', 'pricing', 'contact', 'about', 'other'],
	// ── New types ─────────────────────────────────────────────────────────────
	freelancer: [
		'homepage',
		'work',      // portfolio / projects first
		'contact',
		'about',
		'blog',
		'other',
	],
	agency: [
		'homepage',
		'work',      // case studies / portfolio
		'services',
		'about',
		'contact',
		'blog',
		'legal',
		'other',
	],
	restaurant: [
		'homepage',
		'menu',      // food menu most important
		'contact',   // reservations / address
		'about',
		'blog',
		'other',
	],
	nonprofit: [
		'homepage',
		'donate',    // donation page first
		'about',
		'blog',
		'contact',
		'other',
	],
	event: [
		'homepage',
		'speakers',
		'contact',   // register / tickets
		'about',
		'blog',
		'other',
	],
	directory: [
		'homepage',
		'listings',
		'about',
		'contact',
		'blog',
		'other',
	],
	unknown: [
		'homepage',
		'pricing',
		'features',
		'product',
		'about',
		'contact',
		'docs',
		'blog',
		'legal',
		'other',
	],
};

function hasAuthKeyword(url: URL): boolean {
	const haystack = `${url.pathname}${url.search}${url.hash}`.toLowerCase();
	return AUTH_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

function normalizeInternalPublicUrl(
	href: string | undefined,
	baseUrl: string,
): string | undefined {
	const resolved = resolveUrl(href, baseUrl);
	if (!resolved) return undefined;

	const base = new URL(baseUrl);
	const url = new URL(resolved);

	if (url.origin !== base.origin) return undefined;
	if (!isPublicPage(url.toString())) return undefined;
	if (hasAuthKeyword(url)) return undefined;

	url.hash = '';

	let normalized = url.toString();
	if (url.pathname !== '/' && normalized.endsWith('/')) {
		normalized = normalized.slice(0, -1);
	}

	return normalized;
}

function includesPattern(haystack: string, role: PageRole): boolean {
	return ROLE_PATTERNS[role].some((pattern) => haystack.includes(pattern));
}

export function inferPageRole(
	pageUrl: string,
	baseUrl: string,
	linkText = '',
): PageRole {
	const url = new URL(pageUrl);
	const homepage = new URL('/', baseUrl).toString();
	const path = url.pathname.toLowerCase();
	const haystack = `${path} ${linkText}`.toLowerCase();

	if (pageUrl === homepage || path === '/') return 'homepage';
	if (includesPattern(haystack, 'checkout')) return 'checkout';
	if (includesPattern(haystack, 'cart')) return 'cart';
	if (includesPattern(haystack, 'pricing')) return 'pricing';
	if (includesPattern(haystack, 'donate')) return 'donate';
	if (includesPattern(haystack, 'menu')) return 'menu';
	if (includesPattern(haystack, 'speakers')) return 'speakers';
	if (includesPattern(haystack, 'listings')) return 'listings';

	if (
		/\/products?\//i.test(path) ||
		/\/item\//i.test(path) ||
		/\/shop(\/|$)/i.test(path) ||
		/\/store(\/|$)/i.test(path) ||
		/\/collections?\//i.test(path) ||
		includesPattern(haystack, 'product')
	) {
		return 'product';
	}

	// 'work' before 'features' so /work pages don't fall through to other
	if (includesPattern(haystack, 'work')) return 'work';
	if (includesPattern(haystack, 'services')) return 'services';
	if (includesPattern(haystack, 'team')) return 'team';
	if (includesPattern(haystack, 'features')) return 'features';
	if (includesPattern(haystack, 'about')) return 'about';
	if (includesPattern(haystack, 'contact')) return 'contact';
	if (includesPattern(haystack, 'docs')) return 'docs';
	if (includesPattern(haystack, 'blog')) return 'blog';
	if (includesPattern(haystack, 'legal')) return 'legal';

	return 'other';
}

function collectLinkCandidates(
	$: cheerio.CheerioAPI,
	baseUrl: string,
): LinkCandidate[] {
	const candidates = new Map<string, LinkCandidate>();

	$('a[href]').each((_index, element) => {
		const url = normalizeInternalPublicUrl($(element).attr('href'), baseUrl);
		if (!url) return;

		const text = $(element).text().replace(/\s+/g, ' ').trim().toLowerCase();
		const isNav = $(element).parents('nav, header').length > 0;
		const existing = candidates.get(url);

		if (existing && (!isNav || existing.isNav)) return;

		candidates.set(url, {
			url,
			text,
			isNav,
			role: inferPageRole(url, baseUrl, text),
			score: 0,
		});
	});

	return Array.from(candidates.values());
}

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
		default: {
			// Exhaustive check — if a new package is added to ScanPackage without
			// updating this switch, log a warning so it surfaces in CI/review.
			const _exhaustive: never = pkg;
			console.warn('[page-selection] Unknown scan package:', _exhaustive, '— defaulting to 1 page');
			return 1;
		}
	}
}

function resolveSelectionType(
	websiteType: WebsiteType,
	candidates: LinkCandidate[],
): WebsiteType {
	const roles = new Set(candidates.map((candidate) => candidate.role));

	const hasCommercePages =
		roles.has('product') || roles.has('cart') || roles.has('checkout');

	const hasSaasPages =
		roles.has('features') || roles.has('pricing') || roles.has('docs');

	if (websiteType === 'ecommerce' && !hasCommercePages && hasSaasPages) {
		return 'saas';
	}

	if (
		(websiteType === 'saas' || websiteType === 'webapp') &&
		hasCommercePages &&
		!hasSaasPages
	) {
		return 'ecommerce';
	}

	return websiteType;
}

function roleWeight(role: PageRole, websiteType: WebsiteType): number {
	const priority = ROLE_PRIORITY[websiteType] ?? ROLE_PRIORITY.unknown;
	const index = priority.indexOf(role);

	return index === -1 ? 0 : 100 - index * 8;
}

function depthPenalty(url: string): number {
	const depth = new URL(url).pathname.split('/').filter(Boolean).length;
	return Math.max(0, depth - 2) * 5;
}

function scoreCandidate(
	candidate: LinkCandidate,
	websiteType: WebsiteType,
): number {
	let score = roleWeight(candidate.role, websiteType);

	if (candidate.isNav) score += 12;

	if (websiteType === 'ecommerce') {
		if (candidate.role === 'product') score += 22;
		if (candidate.role === 'cart') score += 10;
		if (candidate.role === 'checkout') score += 8;
		if (candidate.role === 'features') score -= 12;
	}

	if (websiteType === 'saas' || websiteType === 'webapp') {
		if (candidate.role === 'features') score += 20;
		if (candidate.role === 'pricing') score += 18;
		if (candidate.role === 'docs') score += 8;
		if (candidate.role === 'cart' || candidate.role === 'checkout') score -= 30;
	}

	// Freelancer & agency: portfolio/case-studies are the most important pages
	if (websiteType === 'freelancer') {
		if (candidate.role === 'work') score += 25;
	}

	if (websiteType === 'agency') {
		if (candidate.role === 'work') score += 22;
		if (candidate.role === 'services') score += 18;
	}

	if (websiteType === 'business') {
		if (candidate.role === 'services') score += 15;
	}

	// Restaurant: food menu is the key conversion page
	if (websiteType === 'restaurant') {
		if (candidate.role === 'menu') score += 28;
		if (candidate.role === 'contact') score += 12; // reservations
	}

	// Nonprofit: donation page is the primary conversion
	if (websiteType === 'nonprofit') {
		if (candidate.role === 'donate') score += 28;
	}

	// Event: speakers and schedule are the draw
	if (websiteType === 'event') {
		if (candidate.role === 'speakers') score += 22;
	}

	// Directory: search/listings page is the core experience
	if (websiteType === 'directory') {
		if (candidate.role === 'listings') score += 28;
	}

	if (candidate.role === 'other') score -= 30;

	return score - depthPenalty(candidate.url);
}

function rankCandidates(
	candidates: LinkCandidate[],
	websiteType: WebsiteType,
): LinkCandidate[] {
	return candidates
		.map((candidate) => ({
			...candidate,
			score: scoreCandidate(candidate, websiteType),
		}))
		.sort((a, b) => b.score - a.score);
}

function homepagePage(baseUrl: string): SelectedScanPage {
	return {
		url: new URL('/', baseUrl).toString(),
		role: 'homepage',
	};
}

function addUniquePage(
	pages: SelectedScanPage[],
	page: SelectedScanPage | undefined,
	maxCount: number,
): void {
	if (!page) return;
	if (pages.length >= maxCount) return;
	if (pages.some((existing) => existing.url === page.url)) return;

	pages.push(page);
}

function bestPageForRole(
	candidates: LinkCandidate[],
	role: PageRole,
): SelectedScanPage | undefined {
	const candidate = candidates.find((item) => item.role === role);
	if (!candidate) return undefined;

	return {
		url: candidate.url,
		role: candidate.role,
	};
}

function fillWithBestPages(
	pages: SelectedScanPage[],
	candidates: LinkCandidate[],
	maxCount: number,
): void {
	for (const candidate of candidates) {
		addUniquePage(
			pages,
			{
				url: candidate.url,
				role: candidate.role,
			},
			maxCount,
		);

		if (pages.length >= maxCount) break;
	}
}

function roleOrderForPackage(
	websiteType: WebsiteType,
	pkg: ScanPackage,
): PageRole[] {
	const priority = ROLE_PRIORITY[websiteType] ?? ROLE_PRIORITY.unknown;

	if (pkg === 'premium') return priority;

	return priority.filter((role) => role !== 'legal' && role !== 'other');
}

/**
 * Select pages to scan, sorted by role importance for the given website type.
 *
 * Pass `$` when you've already parsed the HTML (e.g. in detectAndSelectPages)
 * so cheerio does not parse the same string twice.
 */
export function selectPagesToTestWithRoles(
	homepageHtml: string,
	baseUrl: string,
	websiteType: WebsiteType,
	pkg: ScanPackage,
	$?: cheerio.CheerioAPI,
): SelectedScanPage[] {
	const maxCount = getPageLimit(pkg);
	if (maxCount === 0) return [];

	const homepage = homepagePage(baseUrl);
	if (maxCount === 1) return [homepage];

	const doc = $ ?? cheerio.load(homepageHtml);
	const rawCandidates = collectLinkCandidates(doc, baseUrl);
	const selectionType = resolveSelectionType(websiteType, rawCandidates);
	const candidates = rankCandidates(rawCandidates, selectionType);

	const pages: SelectedScanPage[] = [homepage];

	for (const role of roleOrderForPackage(selectionType, pkg)) {
		if (role === 'homepage') continue;
		addUniquePage(pages, bestPageForRole(candidates, role), maxCount);
	}

	fillWithBestPages(pages, candidates, maxCount);

	return pages.slice(0, maxCount);
}

export function selectPagesToTest(
	homepageHtml: string,
	baseUrl: string,
	websiteType: WebsiteType,
	pkg: ScanPackage,
	$?: cheerio.CheerioAPI,
): string[] {
	return dedupe(
		selectPagesToTestWithRoles(homepageHtml, baseUrl, websiteType, pkg, $).map(
			(page) => page.url,
		),
	);
}
