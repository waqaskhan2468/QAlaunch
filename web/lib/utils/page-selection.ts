import * as cheerio from 'cheerio';
import type { WebsiteType, ScanPackage } from '@/types/zod';
import { resolveUrl, isPublicPage, dedupe } from './detect';

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

const ROLE_PATTERNS: Record<PageRole, string[]> = {
	homepage: [],
	pricing: ['pricing', 'plans', 'packages'],
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
	cart: ['cart', 'basket'],
	checkout: ['checkout'],
	about: ['about', 'company', 'team', 'who-we-are', 'customers'],
	contact: ['contact', 'demo', 'quote', 'book', 'get-in-touch', 'sales'],
	docs: ['docs', 'documentation', 'help', 'faq', 'support'],
	blog: ['blog', 'posts', 'articles', 'resources', 'news', 'insights'],
	legal: ['privacy', 'terms', 'security', 'compliance'],
	other: [],
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
		'contact',
		'pricing',
		'features',
		'blog',
		'docs',
		'legal',
		'other',
	],
	blog: ['homepage', 'blog', 'about', 'contact', 'docs', 'legal', 'other'],
	portfolio: ['homepage', 'features', 'about', 'contact', 'blog', 'other'],
	landing: ['homepage', 'features', 'pricing', 'contact', 'about', 'other'],
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
		default:
			return 1;
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

export function selectPagesToTestWithRoles(
	homepageHtml: string,
	baseUrl: string,
	websiteType: WebsiteType,
	pkg: ScanPackage,
): SelectedScanPage[] {
	const maxCount = getPageLimit(pkg);
	if (maxCount === 0) return [];

	const homepage = homepagePage(baseUrl);
	if (maxCount === 1) return [homepage];

	const $ = cheerio.load(homepageHtml);
	const rawCandidates = collectLinkCandidates($, baseUrl);
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
): string[] {
	return dedupe(
		selectPagesToTestWithRoles(homepageHtml, baseUrl, websiteType, pkg).map(
			(page) => page.url,
		),
	);
}
