import * as cheerio from 'cheerio';
import type { WebsiteType, ScanPackage } from '@/types/zod';

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const WEBAPP_CONTACT_EMAIL = 'hello@getqalaunch.com';

const WEBAPP_BANNER =
	'Web app detected — for full testing of authenticated areas, contact us for a Custom plan';

const WEBAPP_NOTE =
	'Authenticated areas were not tested. Only publicly accessible pages were scanned.';

/**
 * URL path segments that indicate a private / authenticated page.
 * These are always filtered out of the crawlable page list.
 */
const AUTH_PATH_PATTERN =
	/login|log-in|sign-in|signup|sign-up|register|dashboard|account|settings|auth/i;

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type DetectionResult = {
	type: WebsiteType;
	/**
	 * Per spec (Section 3.2):
	 * When true → scan STILL RUNS on public pages (homepage, pricing, features)
	 * Report notes authenticated areas were not tested.
	 * Results page shows banner + Custom plan CTA.
	 * DO NOT auto-bypass login — manual QA only.
	 */
	requiresAuth: boolean;
	/** Shown inline in the scan report. */
	notes?: string;
	/** Shown as a prominent banner on the results page. */
	banner?: string;
	/** Pre-populated mailto CTA → hello@getqalaunch.com */
	contactUrl?: string;
};

// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────

function includesAny(text: string, needles: string[]): boolean {
	return needles.some((n) => text.includes(n));
}

function dedupe(arr: (string | undefined)[]): string[] {
	return [...new Set(arr.filter((v): v is string => Boolean(v)))];
}

/**
 * Safely resolves a href against a base URL.
 * Skips javascript:, mailto:, tel:, and bare # hrefs.
 */
function resolveUrl(
	href: string | undefined,
	baseUrl: string,
): string | undefined {
	if (
		!href ||
		href === '#' ||
		href.startsWith('javascript:') ||
		href.startsWith('mailto:') ||
		href.startsWith('tel:')
	) {
		return undefined;
	}
	try {
		return new URL(href, baseUrl).toString();
	} catch {
		return undefined;
	}
}

/** Returns true when the URL does NOT match any known auth/private path. */
function isPublicPage(url: string): boolean {
	return !AUTH_PATH_PATTERN.test(url);
}

// ─────────────────────────────────────────────
// HTML NORMALISATION
// ─────────────────────────────────────────────

interface NormalisedPage {
	html: string;
	nav: string;
	body: string;
}

function normalisePage($: cheerio.CheerioAPI): NormalisedPage {
	return {
		html: ($.html() ?? '').toLowerCase(),
		nav: $('nav, header').text().toLowerCase(),
		body: $('body').text().toLowerCase(),
	};
}

// ─────────────────────────────────────────────
// LINK HELPERS
// ─────────────────────────────────────────────

/**
 * Extracts all href values from a Cheerio selection as a plain string[].
 * Uses .map().get() — stable Cheerio API, avoids Element/AnyNode type issues.
 */
function extractHrefs($: cheerio.CheerioAPI, selector: string): string[] {
	return $(selector)
		.map((_i, el) => $(el).attr('href'))
		.get() as string[];
}

/**
 * Collects internal, publicly accessible links from nav/header.
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
// DETECTION SIGNALS
// ─────────────────────────────────────────────

function signalEcommerce(
	$: cheerio.CheerioAPI,
	html: string,
	nav: string,
): boolean {
	return (
		html.includes('shopify') ||
		html.includes('shopify-checkout-api-token') ||
		html.includes('/wp-content/') ||
		html.includes('woocommerce') ||
		$('[class*="wc-"]').length > 0 ||
		includesAny(nav, ['add to cart', 'buy now', 'shop now']) ||
		html.includes('product:') ||
		/\/products\/|\/collections\//i.test(html)
	);
}

/**
 * Webapp = core product is gated behind a login wall.
 *
 * Requires BOTH:
 *   (a) login CTA visible in nav/header
 *   (b) structural signal confirming a gated product
 *
 * Both required to avoid misclassifying SaaS marketing sites
 * (e.g. stripe.com has "Login" in nav but homepage is fully public).
 */
function signalWebapp(url: URL, html: string, nav: string): boolean {
	const hasLoginCta = includesAny(nav, ['login', 'log in', 'sign in']);

	const hasGatedSignal =
		url.hostname.startsWith('app.') ||
		url.pathname.startsWith('/app') ||
		html.includes('dashboard') ||
		html.includes('authenticated') ||
		html.includes('your account') ||
		html.includes('user-portal');

	return hasLoginCta && hasGatedSignal;
}

/**
 * SaaS = public marketing site for a software product.
 * Fires AFTER webapp guard fails — homepage is confirmed public.
 */
function signalSaas(html: string, nav: string): boolean {
	return (
		includesAny(nav, [
			'pricing',
			'sign up',
			'get started',
			'start for free',
			'features',
		]) ||
		includesAny(html, [
			'free trial',
			'per month',
			'per seat',
			'per user',
			'subscription',
		])
	);
}

function signalBusiness(
	$: cheerio.CheerioAPI,
	nav: string,
	body: string,
): boolean {
	return (
		includesAny(nav, ['services', 'about', 'contact', 'what we do']) ||
		includesAny(body, [
			'get a quote',
			'book a call',
			'book a demo',
			'request a quote',
		]) ||
		$('form').length > 0
	);
}

function signalBlog(
	$: cheerio.CheerioAPI,
	html: string,
	body: string,
): boolean {
	return (
		$('article').length > 0 ||
		html.includes('application/rss') ||
		body.includes('recent posts') ||
		$('[itemtype*="Article"]').length > 0
	);
}

function signalPortfolio(nav: string): boolean {
	return includesAny(nav, ['portfolio', 'work', 'projects', 'case studies']);
}

function signalLanding($: cheerio.CheerioAPI): boolean {
	const navAnchorCount = $('nav a').length;
	const hashLinkCount = $('a[href^="#"]').length;
	const hasNav = $('nav').length > 0;
	return (
		(navAnchorCount <= 3 && hashLinkCount > 5) || (!hasNav && hashLinkCount > 3)
	);
}

// ─────────────────────────────────────────────
// WEBSITE TYPE DETECTION
// ─────────────────────────────────────────────

/**
 * Classifies a website from its homepage HTML.
 *
 * Detection priority (first match wins):
 *   ecommerce → webapp → saas → business → blog → portfolio → landing → unknown
 *
 * Per spec Section 3.2 — Webapp behaviour:
 *   requiresAuth: true means scan STILL RUNS on public pages only.
 *   1. Scan public pages (homepage, pricing, features)
 *   2. Report notes authenticated areas not tested  ← notes field
 *   3. Results page shows banner + Custom plan CTA  ← banner + contactUrl fields
 *   DO NOT auto-bypass login.
 */
export function detectWebsiteType(
	homepageHtml: string,
	baseUrl: string,
): DetectionResult {
	const $ = cheerio.load(homepageHtml);
	const { html, nav, body } = normalisePage($);
	const url = new URL(baseUrl);

	// 1. Ecommerce — before webapp: Shopify stores have "Sign in" buttons
	if (signalEcommerce($, html, nav)) {
		return { type: 'ecommerce', requiresAuth: false };
	}

	// 2. Webapp — login required to use core product.
	//    Scan still runs on public pages. Banner shown on results.
	if (signalWebapp(url, html, nav)) {
		return {
			type: 'webapp',
			requiresAuth: true,
			notes: WEBAPP_NOTE,
			banner: WEBAPP_BANNER,
			contactUrl: `mailto:${WEBAPP_CONTACT_EMAIL}?subject=Custom%20Plan%20%E2%80%94%20Authenticated%20QA`,
		};
	}

	// 3. SaaS — public marketing site (webapp guard already failed)
	if (signalSaas(html, nav)) {
		return { type: 'saas', requiresAuth: false };
	}

	// 4. Business / Services
	if (signalBusiness($, nav, body)) {
		return { type: 'business', requiresAuth: false };
	}

	// 5. Blog / Content
	if (signalBlog($, html, body)) {
		return { type: 'blog', requiresAuth: false };
	}

	// 6. Portfolio / Agency
	if (signalPortfolio(nav)) {
		return { type: 'portfolio', requiresAuth: false };
	}

	// 7. Single-page landing
	if (signalLanding($)) {
		return { type: 'landing', requiresAuth: false };
	}

	return { type: 'unknown', requiresAuth: false };
}

// ─────────────────────────────────────────────
// PAGE SELECTION — STANDARD (2–5 pages)
// ─────────────────────────────────────────────

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
		case 'webapp':
			// Per spec: public pages only — homepage + pricing + features
			pages.push(findFirst(navLinks, ['/pricing']));
			pages.push(findFirst(navLinks, ['/features', '/product']));
			break;

		case 'saas':
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
// PAGE SELECTION — PREMIUM (6–10 pages)
// ─────────────────────────────────────────────

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
		case 'webapp':
			// Still public pages only — more than standard but no auth routes ever
			pages.push(findFirst(navLinks, ['/pricing']));
			pages.push(findFirst(navLinks, ['/features', '/product']));
			pages.push(findFirst(navLinks, ['/about']));
			pages.push(findFirst(navLinks, ['/contact', '/demo']));
			pages.push(findFirst(navLinks, ['/security', '/privacy', '/compliance']));
			break;

		case 'saas':
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
			// 2-3 product pages from different categories per spec
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
			// Per spec: include FAQ, blog index, and team pages for business
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
			// landing / unknown
			pages.push(...navLinks.slice(0, 9));
	}

	return dedupe(pages).slice(0, 10);
}

// ─────────────────────────────────────────────
// MAIN ENTRY POINT
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
 * Webapp safety: auth routes are NEVER returned at any tier.
 * isPublicPage() acts as a second safety net on every collected link.
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
