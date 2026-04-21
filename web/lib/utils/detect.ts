import * as cheerio from 'cheerio';
import type { WebsiteType, ScanPackage } from '@/types/zod';

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

/**
 * All contact/upsell copy lives here.
 * Swap the email string when the custom address is ready.
 */
const CONTACT_EMAIL = 'hello@getqalaunch.com'; // TODO: replace with custom email when ready

// Webapp: core product is gated — hard block, manual QA only
const WEBAPP_BANNER =
	'Web app detected — authenticated areas need manual QA. Contact us for a Custom plan.';
const WEBAPP_NOTE =
	'Authenticated areas were not tested. Only publicly accessible pages were scanned.';

// SaaS with login: public site that also has a login — soft upsell notice
const SAAS_LOGIN_NOTICE =
	'We noticed your site has a login. For testing of authenticated areas, contact us for a Custom plan.';

/**
 * URL path segments that indicate a private / authenticated page.
 * These are always filtered out of the crawlable page list regardless of type.
 */
const AUTH_PATH_PATTERN =
	/\/(login|log-in|sign-in|signup|sign-up|register|dashboard|account|settings|auth)(\/|$|\?)/i;

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

/**
 * Describes how the scan should behave and what to show the user.
 *
 * requiresAuth = true  → webapp: core product is gated, creds stored for manual QA
 * hasLoginUpsell = true → saas-with-login: public site detected but login exists,
 *                         show soft notice encouraging Custom plan upgrade
 */
export type DetectionResult = {
	type: WebsiteType;

	/**
	 * TRUE only for webapp: the site's core value requires authentication.
	 * Scan is limited to public pages. Credentials are stored for manual QA.
	 * DO NOT auto-bypass login.
	 */
	requiresAuth: boolean;

	/**
	 * TRUE for SaaS sites that also have a login UI.
	 * The homepage IS publicly accessible so a full scan runs,
	 * but we surface a soft upsell nudge to the user.
	 */
	hasLoginUpsell: boolean;

	/** Shown inline in the scan report body. */
	notes?: string;

	/**
	 * Shown as a prominent banner on the results page.
	 * Set for webapp (hard warning) and saas-with-login (soft notice).
	 */
	banner?: string;

	/**
	 * Pre-populated mailto href for the CTA button.
	 * Shown when requiresAuth OR hasLoginUpsell is true.
	 */
	contactUrl?: string;

	/**
	 * When requiresAuth is true and the user provided credentials,
	 * this flag tells the caller to persist them for the manual QA team.
	 * Credentials must NEVER be used for automated login bypass.
	 */
	storeCredentialsForManualQA: boolean;
};

// ─────────────────────────────────────────────
// CREDENTIALS PAYLOAD
// ─────────────────────────────────────────────

/**
 * Shape of the login credentials the user fills in via the QAlaunch form.
 * Stored securely and handed off to the manual QA team — never used
 * for automated login.
 */
export type WebappCredentials = {
	loginUrl: string;
	email: string;
	/** Store encrypted at rest. Never log. */
	password: string;
	/** Optional: extra context the QA team needs (e.g. 2FA notes, role) */
	notes?: string;
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
 * Skips javascript:, mailto:, tel:, and fragment-only hrefs.
 */
function resolveUrl(
	href: string | undefined,
	baseUrl: string,
): string | undefined {
	if (
		!href ||
		href.startsWith('javascript:') ||
		href.startsWith('mailto:') ||
		href.startsWith('tel:') ||
		href === '#'
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

/**
 * Lowercases HTML, nav text, and body text once upfront.
 * All signal functions receive these pre-lowercased strings.
 */
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
 * Extracts all href attribute values from a selector as a plain string[].
 * Uses .map().get() — the stable Cheerio API that avoids Element/AnyNode types.
 */
function extractHrefs($: cheerio.CheerioAPI, selector: string): string[] {
	return $(selector)
		.map((_i, el) => $(el).attr('href'))
		.get() as string[];
}

/**
 * Collects internal public-facing links from nav/header.
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

/** Returns the first link whose lowercased path contains any of the patterns. */
function findFirst(links: string[], patterns: string[]): string | undefined {
	return links.find((l) => patterns.some((p) => l.toLowerCase().includes(p)));
}

/**
 * Finds up to `limit` product/item page URLs.
 * Uses .reduce() — no .each() / return false needed.
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

/** Finds the first blog post / article URL using semantic selectors. */
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
 * Detects a login CTA anywhere in the nav/header.
 * Used by both webapp and saas-with-login detection.
 */
function signalHasLoginCta(nav: string): boolean {
	return includesAny(nav, ['login', 'log in', 'sign in']);
}

/**
 * Webapp = core product is gated behind a login wall.
 *
 * Requires BOTH a login CTA AND a structural gating signal.
 * This prevents misclassifying a SaaS marketing site (stripe.com has
 * a "Login" button but its homepage is fully public).
 *
 * When true:
 *   → requiresAuth: true
 *   → scan limited to public pages only
 *   → credentials stored for manual QA team
 *   → DO NOT attempt automated login bypass
 */
function signalWebapp(url: URL, html: string, nav: string): boolean {
	const hasLoginCta = signalHasLoginCta(nav);

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
 *
 * Fires AFTER the webapp guard fails, so the homepage is confirmed public.
 * Returns two booleans:
 *   isSaas        — true if commercial SaaS signals are present
 *   hasLoginCta   — true if a login button also exists in the nav
 *
 * hasLoginCta drives the soft upsell notice on the results page.
 */
function signalSaas(
	html: string,
	nav: string,
): { isSaas: boolean; hasLoginCta: boolean } {
	const isSaas =
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
		]);

	return { isSaas, hasLoginCta: signalHasLoginCta(nav) };
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
// CONTACT URL BUILDER
// ─────────────────────────────────────────────

function buildContactUrl(subject: string): string {
	// TODO: replace CONTACT_EMAIL with custom address when ready
	return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

// ─────────────────────────────────────────────
// WEBSITE TYPE DETECTION
// ─────────────────────────────────────────────

/**
 * Classifies a website and determines scan + upsell behaviour.
 *
 * Detection priority (first match wins):
 *   ecommerce → webapp → saas → business → blog → portfolio → landing → unknown
 *
 * ── Three login-related outcomes ────────────────────────────────────────
 *
 *   1. WEBAPP  (requiresAuth: true)
 *      Core product is behind a login wall.
 *      - Scan public pages only (homepage, pricing, features)
 *      - Store user credentials for manual QA team
 *      - Show hard banner on results page
 *      - DO NOT auto-bypass login
 *
 *   2. SAAS WITH LOGIN  (hasLoginUpsell: true)
 *      Public marketing site that also has a login area.
 *      - Scan all public pages normally (full scan runs)
 *      - Show soft notice: "you have a login — contact us for auth testing"
 *      - No credentials needed, no manual QA routing
 *
 *   3. NO LOGIN  (requiresAuth: false, hasLoginUpsell: false)
 *      Fully public site. Standard scan, no special handling.
 */
export function detectWebsiteType(
	homepageHtml: string,
	baseUrl: string,
): DetectionResult {
	const $ = cheerio.load(homepageHtml);
	const { html, nav, body } = normalisePage($);
	const url = new URL(baseUrl);

	// ── 1. Ecommerce ──────────────────────────────────────────────────────
	// Must run before webapp: Shopify stores have "Sign in" but are not webapps.
	if (signalEcommerce($, html, nav)) {
		return {
			type: 'ecommerce',
			requiresAuth: false,
			hasLoginUpsell: false,
			storeCredentialsForManualQA: false,
		};
	}

	// ── 2. Webapp ─────────────────────────────────────────────────────────
	// Core product requires login. Credentials stored, manual QA only.
	if (signalWebapp(url, html, nav)) {
		return {
			type: 'webapp',
			requiresAuth: true,
			hasLoginUpsell: false,
			storeCredentialsForManualQA: true,
			notes: WEBAPP_NOTE,
			banner: WEBAPP_BANNER,
			contactUrl: buildContactUrl('Custom Plan — Authenticated QA'),
		};
	}

	// ── 3. SaaS ───────────────────────────────────────────────────────────
	// Webapp guard failed → homepage is public. Check for login upsell.
	const { isSaas, hasLoginCta } = signalSaas(html, nav);
	if (isSaas) {
		return {
			type: 'saas',
			requiresAuth: false,
			// Has login UI but homepage is public → soft upsell notice only
			hasLoginUpsell: hasLoginCta,
			storeCredentialsForManualQA: false,
			...(hasLoginCta && {
				banner: SAAS_LOGIN_NOTICE,
				contactUrl: buildContactUrl('Custom Plan — Authenticated Area Testing'),
			}),
		};
	}

	// ── 4. Business / Services ────────────────────────────────────────────
	if (signalBusiness($, nav, body)) {
		return {
			type: 'business',
			requiresAuth: false,
			hasLoginUpsell: false,
			storeCredentialsForManualQA: false,
		};
	}

	// ── 5. Blog / Content ─────────────────────────────────────────────────
	if (signalBlog($, html, body)) {
		return {
			type: 'blog',
			requiresAuth: false,
			hasLoginUpsell: false,
			storeCredentialsForManualQA: false,
		};
	}

	// ── 6. Portfolio / Agency ─────────────────────────────────────────────
	if (signalPortfolio(nav)) {
		return {
			type: 'portfolio',
			requiresAuth: false,
			hasLoginUpsell: false,
			storeCredentialsForManualQA: false,
		};
	}

	// ── 7. Landing page ───────────────────────────────────────────────────
	if (signalLanding($)) {
		return {
			type: 'landing',
			requiresAuth: false,
			hasLoginUpsell: false,
			storeCredentialsForManualQA: false,
		};
	}

	// ── 8. Unknown ────────────────────────────────────────────────────────
	return {
		type: 'unknown',
		requiresAuth: false,
		hasLoginUpsell: false,
		storeCredentialsForManualQA: false,
	};
}

// ─────────────────────────────────────────────
// PAGE SELECTION — STANDARD (2–5 pages)
// ─────────────────────────────────────────────

/**
 * webapp → public pages only (homepage + pricing + features).
 *          Never includes authenticated routes regardless of what's in nav.
 * All other types → curated list by type, up to 5 pages.
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
		case 'webapp':
			// Hard limit: public marketing pages only. No auth pages ever.
			pages.push(findFirst(navLinks, ['/pricing']));
			pages.push(findFirst(navLinks, ['/features', '/product']));
			break;

		case 'saas':
			// Full scan — homepage is public. Login pages filtered by isPublicPage.
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

/**
 * webapp → still limited to public pages only (expanded list vs standard).
 * All other types → wider curated list by type, up to 10 pages.
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
		case 'webapp':
			// Still public-facing only — more pages vs standard but no auth routes.
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
 * Package behaviour:
 *   free       → homepage only (preview scan)
 *   basic      → homepage only (full single-page scan)
 *   standard   → 2–5 curated pages by website type
 *   premium    → 6–10 curated pages by website type
 *   enterprise → [] — pages chosen manually by QA team
 *
 * Auth safety: when websiteType is 'webapp', authenticated routes are
 * never returned at any tier. isPublicPage() filters them as a second
 * safety net even if they somehow appear in nav.
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
			// Pages selected manually by QA team — return empty list.
			return [];

		default:
			return [homepage];
	}
}

// ─────────────────────────────────────────────
// CREDENTIAL STORAGE HELPER
// ─────────────────────────────────────────────

/**
 * Validates and prepares a WebappCredentials payload for storage.
 *
 * Call this ONLY when DetectionResult.storeCredentialsForManualQA is true.
 * The returned object should be persisted encrypted and surfaced to the
 * manual QA team — never used for automated login.
 *
 * Usage:
 *   const detection = detectWebsiteType(html, baseUrl);
 *   if (detection.storeCredentialsForManualQA && userSubmittedCreds) {
 *     const creds = prepareCredentials(userSubmittedCreds);
 *     await db.webappCredentials.create({ data: creds, scanId });
 *   }
 */
export function prepareCredentials(raw: WebappCredentials): WebappCredentials {
	if (!raw.loginUrl || !raw.email || !raw.password) {
		throw new Error('loginUrl, email, and password are all required');
	}

	// Normalise the login URL
	const loginUrl = new URL(raw.loginUrl).toString();

	return {
		loginUrl,
		email: raw.email.trim().toLowerCase(),
		password: raw.password, // encrypt before persisting — do not trim passwords
		notes: raw.notes?.trim(),
	};
}
