import * as cheerio from 'cheerio';
import type { WebsiteType } from '@/types/zod';

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const CONTACT_EMAIL = 'hello@getqalaunch.com';

const AUTH_BANNER =
	'We noticed this site has login / sign-up areas. Authenticated pages were not tested — contact us for a Custom plan to include them.';

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

/**
 * Detects whether a site has login / sign-up / auth areas.
 *
 * Works in layers — each layer catches a different class of site:
 *
 *   Layer 1 — URL structure signals (catches app.* subdomains, /login paths)
 *   Layer 2 — Login form in HTML (password field = strongest possible signal)
 *   Layer 3 — Page title signals (catches JS-heavy sites like Notion, Facebook
 *              that return minimal HTML but still set a meaningful <title>)
 *   Layer 4 — Nav / body text signals (catches marketing sites with login CTA)
 *   Layer 5 — Structural signals (dashboard, authenticated, user-portal)
 *
 * Per spec: when true → scan runs on public pages + banner + note shown.
 * DO NOT stop the scan. DO NOT auto-bypass login.
 */
function detectAuthPresence(
	$: cheerio.CheerioAPI,
	url: URL,
	html: string,
	nav: string,
	body: string,
	title: string,
): boolean {
	// ── Layer 1: URL structure ─────────────────────────────────────────────
	// app.* subdomains or /app paths are almost always gated products
	if (
		url.hostname.startsWith('app.') ||
		url.hostname.startsWith('accounts.') ||
		url.hostname.startsWith('my.') ||
		url.pathname.startsWith('/app/')
	) {
		return true;
	}

	// ── Layer 2: Password field in HTML ───────────────────────────────────
	// The single strongest signal — a password input means a login form exists
	if (
		html.includes('type="password"') ||
		html.includes("type='password'") ||
		html.includes('type=password')
	) {
		return true;
	}

	// ── Layer 3: Page title signals ───────────────────────────────────────
	// Catches JS-rendered sites (Notion, Facebook, Gmail) that return a <title>
	// even when the body HTML is minimal or server-rendered differently
	if (
		includesAny(title, [
			'log in',
			'login',
			'sign in',
			'signin',
			'sign up',
			'signup',
			'create account',
			'register',
			'welcome back',
		])
	) {
		return true;
	}

	// ── Layer 4: Nav / body text login signals ────────────────────────────
	// Login CTA in nav is a strong signal — combined with any secondary signal
	const hasLoginCta = includesAny(nav, [
		'log in',
		'login',
		'sign in',
		'signin',
	]);

	const hasSignupCta = includesAny(nav, [
		'sign up',
		'signup',
		'get started for free',
		'create account',
		'register',
	]);

	// Nav has BOTH login and signup = definite auth-aware site
	if (hasLoginCta && hasSignupCta) {
		return true;
	}

	// ── Layer 5: Structural / gated product signals ───────────────────────
	// Dashboard, user-portal, authenticated markers = product is gated
	const hasGatedSignal =
		html.includes('dashboard') ||
		html.includes('user-portal') ||
		html.includes('"authenticated"') ||
		html.includes("'authenticated'") ||
		html.includes('data-auth') ||
		html.includes('isloggedin') ||
		html.includes('is-logged-in');

	// Login CTA + gated signal together = webapp
	if (hasLoginCta && hasGatedSignal) {
		return true;
	}

	// ── Layer 6: Meta / link signals ─────────────────────────────────────
	// OpenGraph or meta tags explicitly mentioning login/signup pages
	const metaDesc =
		$('meta[name="description"]').attr('content')?.toLowerCase() ?? '';
	const ogTitle =
		$('meta[property="og:title"]').attr('content')?.toLowerCase() ?? '';

	if (
		includesAny(metaDesc, [
			'log in',
			'sign in',
			'create account',
			'sign up to',
		]) ||
		includesAny(ogTitle, ['log in', 'sign in', 'welcome back'])
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
	return (
		html.includes('shopify') ||
		html.includes('shopify-checkout-api-token') ||
		html.includes('/wp-content/') ||
		html.includes('woocommerce') ||
		$('[class*="wc-"]').length > 0 ||
		includesAny(nav, ['add to cart', 'buy now', 'shop now']) ||
		// NOTE: 'product:' must NOT match generic words — check carefully
		html.includes('<meta property="product:') ||
		/\/products\/|\/collections\//i.test(html)
	);
}

function signalSaas(html: string, nav: string): boolean {
	return (
		includesAny(nav, [
			'pricing',
			'get started',
			'start for free',
			'features',
			'solutions',
		]) ||
		includesAny(html, [
			'free trial',
			'per month',
			'per seat',
			'per user',
			'/month',
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
// MAIN EXPORT — WEBSITE TYPE DETECTION
// ─────────────────────────────────────────────

/**
 * Classifies a website and detects auth presence from its homepage HTML.
 *
 * Detection priority (first match wins):
 *   ecommerce → saas → business → blog → portfolio → landing → unknown
 *
 * Auth detection runs INDEPENDENTLY across all types via detectAuthPresence().
 * Any site can have requiresAuth: true regardless of its type.
 *
 * Per spec Section 3.2 — when requiresAuth is true:
 *   1. Scan still runs on public pages (homepage, pricing, features)
 *   2. Report body shows AUTH_NOTE
 *   3. Results page shows AUTH_BANNER + Custom plan CTA
 *   4. CTA → hello@getqalaunch.com
 *   DO NOT auto-bypass login.
 */
export function detectWebsiteType(
	homepageHtml: string,
	baseUrl: string,
): DetectionResult {
	const $ = cheerio.load(homepageHtml);
	const { html, nav, body, title } = normalisePage($);
	const url = new URL(baseUrl);

	// Auth detection runs first and is independent of website type
	const requiresAuth = detectAuthPresence($, url, html, nav, body, title);

	// Build the auth payload once — reused in the result if needed
	const authPayload =
		requiresAuth ?
			{
				notes: AUTH_NOTE,
				banner: AUTH_BANNER,
				contactUrl: `mailto:${CONTACT_EMAIL}?subject=Custom%20Plan%20%E2%80%94%20Authenticated%20QA`,
			}
		:	{};

	// ── 1. Ecommerce ──────────────────────────────────────────────────────
	if (signalEcommerce($, html, nav)) {
		return { type: 'ecommerce', requiresAuth, ...authPayload };
	}

	// ── 2. SaaS ───────────────────────────────────────────────────────────
	// Note: webapp is no longer a separate type per this refactor.
	// A webapp IS a SaaS — the difference is captured by requiresAuth.
	// notion.com → saas + requiresAuth: true
	// stripe.com → saas + requiresAuth: false
	if (signalSaas(html, nav)) {
		return { type: 'saas', requiresAuth, ...authPayload };
	}

	// ── 3. Business / Services ────────────────────────────────────────────
	if (signalBusiness($, nav, body)) {
		return { type: 'business', requiresAuth, ...authPayload };
	}

	// ── 4. Blog / Content ─────────────────────────────────────────────────
	if (signalBlog($, html, body)) {
		return { type: 'blog', requiresAuth, ...authPayload };
	}

	// ── 5. Portfolio / Agency ─────────────────────────────────────────────
	if (signalPortfolio(nav)) {
		return { type: 'portfolio', requiresAuth, ...authPayload };
	}

	// ── 6. Single-page landing ────────────────────────────────────────────
	if (signalLanding($)) {
		return { type: 'landing', requiresAuth, ...authPayload };
	}

	// ── 7. Unknown — still flag auth if detected ──────────────────────────
	return { type: 'unknown', requiresAuth, ...authPayload };
}
