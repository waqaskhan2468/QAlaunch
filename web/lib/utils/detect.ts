import * as cheerio from 'cheerio';
import type { WebsiteType } from '@/types/zod';

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const CONTACT_EMAIL = 'hello@getqalaunch.com';

const AUTH_BANNER =
	'Web app detected — for full testing of authenticated areas, contact us for a Custom plan.';

const AUTH_NOTE =
	'This site has login or sign-up functionality. Authenticated areas were not scanned. Only publicly accessible pages were tested.';

/**
 * URL path segments that are private / authenticated.
 * Used to filter these out of the crawlable page list.
 */
export const AUTH_PATH_PATTERN =
	/\/(login|log-in|sign-in|signin|signup|sign-up|register|dashboard|account|settings|auth|logout|profile|my-account)(\/|$|\?|#)/i;

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type DetectionResult = {
	type: WebsiteType;

	/**
	 * True when the site has login / sign-up / auth areas detected.
	 *
	 * Per spec Section 3.2:
	 *   1. Scan STILL RUNS on publicly accessible pages
	 *   2. Report shows AUTH_NOTE  ("Authenticated areas not tested")
	 *   3. Results page shows AUTH_BANNER + Custom plan CTA
	 *   4. CTA → hello@getqalaunch.com
	 *   DO NOT auto-bypass login.
	 */
	requiresAuth: boolean;

	/** Shown inline in the scan report body. */
	notes?: string;

	/** Shown as a prominent banner on the results page. */
	banner?: string;

	/** Pre-populated mailto CTA for the Custom plan. */
	contactUrl?: string;
};

// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────

export function includesAny(text: string, needles: string[]): boolean {
	return needles.some((n) => text.includes(n));
}

export function resolveUrl(
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

export function isPublicPage(url: string): boolean {
	return !AUTH_PATH_PATTERN.test(url);
}

export function dedupe(arr: (string | undefined)[]): string[] {
	return [...new Set(arr.filter((v): v is string => Boolean(v)))];
}

export function extractHrefs(
	$: cheerio.CheerioAPI,
	selector: string,
): string[] {
	return $(selector)
		.map((_i, el) => $(el).attr('href'))
		.get() as string[];
}

// ─────────────────────────────────────────────
// HTML NORMALISATION
// ─────────────────────────────────────────────

export interface NormalisedPage {
	html: string;
	nav: string;
	body: string;
	title: string;
}

export function normalisePage($: cheerio.CheerioAPI): NormalisedPage {
	return {
		html: ($.html() ?? '').toLowerCase(),
		nav: $('nav, header').text().toLowerCase(),
		body: $('body').text().toLowerCase(),
		title: $('title').text().toLowerCase(),
	};
}

// ─────────────────────────────────────────────
// AUTH DETECTION — CORE LOGIC
// ─────────────────────────────────────────────

function detectAuthPresence(
	$: cheerio.CheerioAPI,
	url: URL,
	html: string,
	nav: string,
	body: string,
	title: string,
): boolean {
	// Layer 1: URL / hostname signals
	const host = url.hostname.toLowerCase();
	const path = url.pathname.toLowerCase();

	const authSubdomains = [
		'app.',
		'accounts.',
		'auth.',
		'id.',
		'login.',
		'workspace.',
		'my.',
	];

	if (authSubdomains.some((prefix) => host.startsWith(prefix))) {
		return true;
	}

	if (
		path === '/app' ||
		path.startsWith('/app/') ||
		path.startsWith('/login') ||
		path.startsWith('/log-in') ||
		path.startsWith('/signin') ||
		path.startsWith('/sign-in') ||
		path.startsWith('/signup') ||
		path.startsWith('/sign-up') ||
		path.startsWith('/register') ||
		path.startsWith('/auth') ||
		path.startsWith('/account')
	) {
		return true;
	}

	// Layer 2: Password field in HTML
	if (
		html.includes('type="password"') ||
		html.includes("type='password'") ||
		html.includes('type=password')
	) {
		return true;
	}

	// Layer 3: Anchor/form attribute signals
	const authHrefSelectors = [
		'a[href*="login" i]',
		'a[href*="log-in" i]',
		'a[href*="signin" i]',
		'a[href*="sign-in" i]',
		'a[href*="signup" i]',
		'a[href*="sign-up" i]',
		'a[href*="register" i]',
		'a[href*="/auth" i]',
		'form[action*="login" i]',
		'form[action*="signin" i]',
		'form[action*="signup" i]',
		'form[action*="auth" i]',
	].join(', ');

	if ($(authHrefSelectors).length > 0) {
		return true;
	}

	// Layer 4: Text signals
	const authWords = [
		'log in',
		'login',
		'sign in',
		'signin',
		'sign up',
		'signup',
		'register',
		'create account',
		'welcome back',
		'forgot password',
	];

	if (
		includesAny(title, authWords) ||
		includesAny(nav, authWords) ||
		includesAny(body, authWords)
	) {
		return true;
	}

	// Layer 5: Structural gated signals
	const hasGatedSignal =
		html.includes('dashboard') ||
		html.includes('user-portal') ||
		html.includes('"authenticated"') ||
		html.includes("'authenticated'") ||
		html.includes('data-auth') ||
		html.includes('isloggedin') ||
		html.includes('is-logged-in') ||
		html.includes('workspace') ||
		html.includes('admin panel');

	if (hasGatedSignal) {
		return true;
	}

	// Layer 6: Meta / OpenGraph signals
	const metaDesc =
		$('meta[name="description"]').attr('content')?.toLowerCase() ?? '';
	const ogTitle =
		$('meta[property="og:title"]').attr('content')?.toLowerCase() ?? '';
	const ogDesc =
		$('meta[property="og:description"]').attr('content')?.toLowerCase() ?? '';

	if (
		includesAny(metaDesc, authWords) ||
		includesAny(ogTitle, authWords) ||
		includesAny(ogDesc, authWords)
	) {
		return true;
	}

	return false;
}

// ─────────────────────────────────────────────
// WEBSITE TYPE SIGNALS
// ─────────────────────────────────────────────

function signalEcommerce(
	$: cheerio.CheerioAPI,
	html: string,
	nav: string,
): boolean {
	const hasCartOrCheckout =
		$('a[href*="/cart"], a[href*="/checkout"], form[action*="/cart"]')
			.length > 0;

	const hasBuyButtons =
		$('button, a').filter((_i, el) =>
			/add to cart|buy now|checkout/i.test($(el).text()),
		).length > 0;

	const hasCommercePlatform =
		html.includes('shopify-checkout-api-token') ||
		html.includes('woocommerce') ||
		$('[class*="woocommerce"], [class*="wc-"]').length > 0;

	const hasProductMetadata = html.includes('<meta property="product:');
	const hasShopNavigation = includesAny(nav, ['shop', 'cart', 'checkout']);

	return (
		hasCommercePlatform ||
		hasCartOrCheckout ||
		hasBuyButtons ||
		hasProductMetadata ||
		hasShopNavigation
	);
}

function signalSaas(html: string, nav: string, url: URL): boolean {
	return (
		includesAny(nav, [
			'pricing',
			'get started',
			'start for free',
			'features',
			'solutions',
			'login',
			'sign in',
			'sign up',
		]) ||
		includesAny(html, [
			'free trial',
			'per month',
			'per seat',
			'per user',
			'/month',
			'subscription',
			'dashboard',
		]) ||
		url.hostname.startsWith('app.')
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
		$('[itemtype*="Article"]').length > 0 ||
		/\/blog\//i.test(html)
	);
}

function signalPortfolio(nav: string, body: string): boolean {
	return (
		includesAny(nav, ['portfolio', 'work', 'projects', 'case studies']) ||
		includesAny(body, ['case studies', 'our team', 'selected work'])
	);
}

function signalLanding($: cheerio.CheerioAPI, body: string): boolean {
	const navAnchorCount = $('nav a').length;
	const hashLinkCount = $('a[href^="#"]').length;
	const hasNav = $('nav').length > 0;

	const repeatedCta =
		(body.match(/get started|book demo|start free trial|contact us/g) ?? [])
			.length >= 2;

	return (
		(navAnchorCount <= 3 && hashLinkCount > 5) ||
		(!hasNav && hashLinkCount > 3) ||
		repeatedCta
	);
}

// ─────────────────────────────────────────────
// MAIN EXPORT — WEBSITE TYPE DETECTION
// ─────────────────────────────────────────────

export function detectWebsiteType(
	homepageHtml: string,
	baseUrl: string,
): DetectionResult {
	const $ = cheerio.load(homepageHtml);
	const { html, nav, body, title } = normalisePage($);
	const url = new URL(baseUrl);

	const requiresAuth = detectAuthPresence($, url, html, nav, body, title);

	const authPayload =
		requiresAuth ?
			{
				notes: AUTH_NOTE,
				banner: AUTH_BANNER,
				contactUrl: `mailto:${CONTACT_EMAIL}?subject=Custom%20Plan%20%E2%80%94%20Authenticated%20QA`,
			}
		:	{};

	// Strong ecommerce signals first, then SaaS/business/content signals.

	if (signalEcommerce($, html, nav)) {
		return { type: 'ecommerce', requiresAuth, ...authPayload };
	}

	if (signalSaas(html, nav, url)) {
		return { type: 'saas', requiresAuth, ...authPayload };
	}

	if (signalBusiness($, nav, body)) {
		return { type: 'business', requiresAuth, ...authPayload };
	}

	if (signalBlog($, html, body)) {
		return { type: 'blog', requiresAuth, ...authPayload };
	}

	if (signalPortfolio(nav, body)) {
		return { type: 'portfolio', requiresAuth, ...authPayload };
	}

	if (signalLanding($, body)) {
		return { type: 'landing', requiresAuth, ...authPayload };
	}

	return { type: 'unknown', requiresAuth, ...authPayload };
}
