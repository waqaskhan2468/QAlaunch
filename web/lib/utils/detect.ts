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

/**
 * URL path/query fragment keywords that indicate an auth-gated area.
 * Exported so page-selection.ts can import the single source of truth.
 */
export const AUTH_KEYWORDS = [
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
	_body: string,
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

	// Layer 4: Title and nav text only — NOT body.
	// Checking body causes false-positives on marketing sites that mention
	// "sign in" or "log in" anywhere in their copy (e.g. "Sign in to your account
	// to get started" in a feature description).
	const authWords = [
		'log in',
		'login',
		'sign in',
		'signin',
		'sign up',
		'signup',
		'register',
		'create account',
		'forgot password',
	];

	if (includesAny(title, authWords) || includesAny(nav, authWords)) {
		return true;
	}

	// Layer 5: Unambiguous structural gated signals only.
	// Removed 'dashboard' and 'workspace' — far too common in marketing copy
	// ("manage your dashboard", "team workspace"). Only keep code-level attributes
	// that a marketing page would never include.
	const hasGatedSignal =
		html.includes('user-portal') ||
		html.includes('"authenticated"') ||
		html.includes("'authenticated'") ||
		html.includes('data-auth') ||
		html.includes('isloggedin') ||
		html.includes('is-logged-in') ||
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

function signalRestaurant(
	$: cheerio.CheerioAPI,
	html: string,
	nav: string,
	body: string,
): boolean {
	const hasMenuNav = includesAny(nav, [
		'our menu',
		'menu',
		'reservations',
		'book a table',
		'order online',
		'order now',
	]);

	const hasRestaurantBody = includesAny(body, [
		'restaurant',
		'cuisine',
		'reservations',
		'dining',
		'dine with us',
		'our chef',
		'food menu',
		'dinner menu',
		'lunch menu',
	]);

	// Schema.org structured data or reservation platform embeds
	const hasRestaurantSchema =
		html.includes('"restaurant"') ||
		html.includes('"foodestablishment"') ||
		html.includes('opentable') ||
		html.includes('resy.com') ||
		$('[class*="reservation"], [id*="reservation"]').length > 0;

	return hasMenuNav || hasRestaurantBody || hasRestaurantSchema;
}

function signalEvent(html: string, nav: string, body: string): boolean {
	const hasEventNav = includesAny(nav, [
		'schedule',
		'speakers',
		'agenda',
		'register',
		'tickets',
		'get tickets',
	]);

	const hasEventBody = includesAny(body, [
		'conference',
		'summit',
		'symposium',
		'workshop',
		'get tickets',
		'buy tickets',
		'early bird',
		'register now',
	]);

	// Schema.org Event type
	const hasEventSchema = html.includes('"event"');

	return hasEventNav || hasEventBody || hasEventSchema;
}

function signalNonprofit(nav: string, body: string): boolean {
	const hasDonateNav = includesAny(nav, [
		'donate',
		'give',
		'get involved',
		'volunteer',
		'support us',
	]);

	const hasNonprofitBody = includesAny(body, [
		'501(c)',
		'nonprofit',
		'non-profit',
		'charity',
		'make a difference',
		'tax-deductible',
		'fundraising',
		'donation',
	]);

	return hasDonateNav || hasNonprofitBody;
}

function signalDirectory(
	$: cheerio.CheerioAPI,
	nav: string,
	body: string,
): boolean {
	const hasDirectoryNav = includesAny(nav, [
		'browse',
		'categories',
		'listings',
		'directory',
		'submit listing',
	]);

	const hasSearchWithListings =
		$('input[type="search"], input[placeholder*="search" i]').length > 0 &&
		includesAny(body, [
			'browse listings',
			'submit a listing',
			'submit listing',
			'search results',
			'filter by',
			'all categories',
		]);

	const hasListingMarkup =
		$('[class*="listing-card"], [class*="directory-card"], [class*="listing-item"]')
			.length > 2;

	return hasDirectoryNav || hasSearchWithListings || hasListingMarkup;
}

function signalFreelancer(
	$: cheerio.CheerioAPI,
	nav: string,
	body: string,
): boolean {
	// Strong hire-me signals in nav
	const hasHireMeNav = includesAny(nav, [
		'hire me',
		'available for hire',
		'work with me',
		'get in touch',
	]);

	// Personal intro phrases
	const hasPersonalIntro = includesAny(body, [
		"i'm a ",
		'i am a ',
		"hello, i'm",
		"hi, i'm",
		"hey, i'm",
		"i'm an ",
		'i am an ',
	]);

	// Explicit freelance availability language
	const hasHireMeBody = includesAny(body, [
		'available for hire',
		'hire me',
		'open to opportunities',
		'open to work',
		'freelance designer',
		'freelance developer',
		'freelance writer',
		'freelance illustrator',
		'freelance photographer',
	]);

	// Social/portfolio platform links typical of personal sites
	const hasCreativeSocials =
		$('a[href*="github.com"], a[href*="dribbble.com"], a[href*="behance.net"], a[href*="codepen.io"]')
			.length > 0;

	// "freelance" anywhere + personal signals
	const isFreelancePlusPersonal =
		body.includes('freelance') &&
		(hasPersonalIntro || hasCreativeSocials || hasHireMeNav);

	return hasHireMeNav || hasHireMeBody || isFreelancePlusPersonal;
}

function signalAgency(
	$: cheerio.CheerioAPI,
	nav: string,
	body: string,
): boolean {
	const hasAgencyNav = includesAny(nav, [
		'our work',
		'case studies',
		'clients',
		'what we do',
		'our services',
	]);

	const hasAgencyBody = includesAny(body, [
		'we are a',
		"we're a",
		'our agency',
		'digital agency',
		'creative agency',
		'marketing agency',
		'branding agency',
		'design agency',
		'award-winning',
		'full-service',
	]);

	// Agency-specific page structure: team + services pages present
	const hasAgencyStructure =
		$('a[href*="team"], a[href*="our-team"], a[href*="work"], a[href*="case-studies"]')
			.length > 1;

	return hasAgencyNav || hasAgencyBody || (hasAgencyStructure && hasAgencyBody);
}

function signalSaas(html: string, nav: string): boolean {
	// Removed: 'login', 'sign in', 'sign up' — those are auth signals, not SaaS signals.
	// Removed: 'dashboard' from html check — too common in marketing copy.
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

function signalWebapp($: cheerio.CheerioAPI, html: string, nav: string, url: URL): boolean {
	// Dedicated app subdomain (e.g. app.acme.com) that wasn't caught by ecommerce/restaurant
	if (url.hostname.startsWith('app.')) return true;

	// App-like primary navigation
	if (
		includesAny(nav, ['dashboard', 'projects', 'tasks', 'workspace', 'inbox', 'analytics'])
	) {
		return true;
	}

	// Web app manifest or app-shell patterns
	return (
		html.includes('application/manifest+json') ||
		$('meta[name="apple-mobile-web-app-capable"]').length > 0
	);
}

function signalBusiness(
	$: cheerio.CheerioAPI,
	nav: string,
	body: string,
): boolean {
	// Removed: `$('form').length > 0` — contact/search forms appear on almost every site.
	return (
		includesAny(nav, ['services', 'about', 'contact', 'what we do']) ||
		includesAny(body, [
			'get a quote',
			'book a call',
			'book a demo',
			'request a quote',
		])
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

/**
 * Detect the website type from homepage HTML.
 *
 * Pass `$` when you've already parsed the HTML with cheerio (e.g. in
 * detectAndSelectPages) so the HTML is not parsed twice.
 */
export function detectWebsiteType(
	homepageHtml: string,
	baseUrl: string,
	$?: cheerio.CheerioAPI,
): DetectionResult {
	const doc = $ ?? cheerio.load(homepageHtml);
	const { html, nav, body, title } = normalisePage(doc);
	const url = new URL(baseUrl);

	const requiresAuth = detectAuthPresence(doc, url, html, nav, body, title);

	const authPayload =
		requiresAuth ?
			{
				notes: AUTH_NOTE,
				banner: AUTH_BANNER,
				contactUrl: `mailto:${CONTACT_EMAIL}?subject=Custom%20Plan%20%E2%80%94%20Authenticated%20QA`,
			}
		:	{};

	// Detection order: most-specific types first to avoid false-positive
	// fallthrough into generic buckets (business, portfolio, landing).

	if (signalEcommerce(doc, html, nav)) {
		return { type: 'ecommerce', requiresAuth, ...authPayload };
	}

	if (signalRestaurant(doc, html, nav, body)) {
		return { type: 'restaurant', requiresAuth, ...authPayload };
	}

	if (signalEvent(html, nav, body)) {
		return { type: 'event', requiresAuth, ...authPayload };
	}

	if (signalNonprofit(nav, body)) {
		return { type: 'nonprofit', requiresAuth, ...authPayload };
	}

	if (signalDirectory(doc, nav, body)) {
		return { type: 'directory', requiresAuth, ...authPayload };
	}

	if (signalFreelancer(doc, nav, body)) {
		return { type: 'freelancer', requiresAuth, ...authPayload };
	}

	if (signalAgency(doc, nav, body)) {
		return { type: 'agency', requiresAuth, ...authPayload };
	}

	// webapp before saas: app.* subdomains and app-shell pages are webapps,
	// not marketing sites.
	if (signalWebapp(doc, html, nav, url)) {
		return { type: 'webapp', requiresAuth, ...authPayload };
	}

	if (signalSaas(html, nav)) {
		return { type: 'saas', requiresAuth, ...authPayload };
	}

	if (signalBusiness(doc, nav, body)) {
		return { type: 'business', requiresAuth, ...authPayload };
	}

	if (signalBlog(doc, html, body)) {
		return { type: 'blog', requiresAuth, ...authPayload };
	}

	if (signalPortfolio(nav, body)) {
		return { type: 'portfolio', requiresAuth, ...authPayload };
	}

	if (signalLanding(doc, body)) {
		return { type: 'landing', requiresAuth, ...authPayload };
	}

	return { type: 'unknown', requiresAuth, ...authPayload };
}
