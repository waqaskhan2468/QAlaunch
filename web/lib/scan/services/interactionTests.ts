import type { Page } from 'playwright-core';
import type { LinksResult, ValidatedLink } from '../types/scan.types';
import { logScanTiming } from './scan-timing';

// ─── Types ────────────────────────────────────────────────────────────────────

export type InteractionTestStatus = 'pass' | 'fail' | 'skip' | 'error';

export type InteractionTestResult = {
	id: string;
	name: string;
	status: InteractionTestStatus;
	detail?: string;
	durationMs: number;
};

export type InteractionTestsPayload = {
	results: InteractionTestResult[];
	durationMs: number;
	testsRun: number;
	testsFailed: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeResult(
	id: string,
	name: string,
	status: InteractionTestStatus,
	startedAt: number,
	detail?: string,
): InteractionTestResult {
	return { id, name, status, detail, durationMs: Date.now() - startedAt };
}

const FETCH_TIMEOUT_MS = 5_000;

async function headFetch(url: string): Promise<{ status: number; ok: boolean }> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	try {
		const res = await fetch(url, {
			method: 'HEAD',
			signal: controller.signal,
			redirect: 'follow',
		});
		return { status: res.status, ok: res.ok };
	} catch {
		return { status: 0, ok: false };
	} finally {
		clearTimeout(timer);
	}
}

// ─── Test 1: 404 / soft-404 detection ────────────────────────────────────────
//
// IMPORTANT: uses Node.js fetch() — NOT page.goto().
// page.goto() would navigate the shared Playwright page, destroying the
// execution context of axe and other parallel collectors.
// A plain HEAD request is faster (~200 ms) and has zero side-effects on the page.

async function test404Page(originalUrl: string): Promise<InteractionTestResult> {
	const id = 'test-404';
	const name = '404 page handling';
	const startedAt = Date.now();

	try {
		const fakeUrl = new URL('/qalaunch-test-404-xk9z', originalUrl).toString();
		const { status } = await headFetch(fakeUrl);

		if (status === 404 || status === 410) {
			return makeResult(id, name, 'pass', startedAt, `Correctly returned HTTP ${status}`);
		}

		if (status === 200) {
			return makeResult(
				id,
				name,
				'fail',
				startedAt,
				'Soft 404 — unknown URLs return HTTP 200. Search engines cannot distinguish real pages from missing ones, which harms SEO.',
			);
		}

		return makeResult(id, name, 'skip', startedAt, `Unexpected status ${status}`);
	} catch (error) {
		return makeResult(
			id,
			name,
			'error',
			startedAt,
			error instanceof Error ? error.message : 'fetch failed',
		);
	}
}

// ─── Test 2: Form validation ──────────────────────────────────────────────────
//
// Clicks submit on an empty form — HTML5 validation fires client-side BEFORE
// any network request so no data is ever sent and no navigation occurs.

async function testFormValidation(page: Page): Promise<InteractionTestResult> {
	const id = 'test-form-validation';
	const name = 'Form validation feedback';
	const startedAt = Date.now();

	try {
		const formHandle = await page.evaluateHandle(() => {
			const forms = Array.from(document.querySelectorAll('form'));
			const authKeywords = ['login', 'signin', 'sign-in', 'auth', 'register', 'password'];
			return (
				forms.find((form) => {
					const action = (form.getAttribute('action') ?? '').toLowerCase();
					const html = form.innerHTML.toLowerCase();
					return !authKeywords.some((kw) => action.includes(kw) || html.includes(kw));
				}) ?? null
			);
		});

		const form = formHandle.asElement();
		if (!form) {
			return makeResult(id, name, 'skip', startedAt, 'No non-auth form found on this page');
		}

		const submitBtn = await form.$('button[type="submit"], input[type="submit"], button:not([type])');
		if (!submitBtn) {
			return makeResult(id, name, 'skip', startedAt, 'Form has no submit button');
		}

		const hasRequired = await form.$('input[required], textarea[required], select[required]');
		if (!hasRequired) {
			return makeResult(id, name, 'skip', startedAt, 'Form has no required fields');
		}

		await submitBtn.click();
		await page.waitForTimeout(400);

		const validationVisible = await page.evaluate(() => {
			return [
				'[aria-invalid="true"]',
				'[class*="error"]',
				'[class*="invalid"]',
				'[role="alert"]',
				'.invalid-feedback',
				'.help-block',
			].some((sel) => document.querySelector(sel) !== null);
		});

		const hasNativeValidation = await form.evaluate((f) => {
			const inputs = Array.from(f.querySelectorAll<HTMLInputElement>('input, textarea, select'));
			return inputs.some((el) => !el.validity.valid);
		});

		if (validationVisible || hasNativeValidation) {
			return makeResult(id, name, 'pass', startedAt, 'Form shows validation on empty submit');
		}

		return makeResult(
			id,
			name,
			'fail',
			startedAt,
			'Empty form submission showed no validation error. Users may submit incomplete data.',
		);
	} catch (error) {
		return makeResult(id, name, 'error', startedAt, error instanceof Error ? error.message : 'test error');
	}
}

// ─── Test 3: Search functionality ────────────────────────────────────────────
//
// Types into a search input and waits for AJAX suggestions — does NOT press
// Enter (which would navigate the page and destroy execution contexts).

async function testSearchFunctionality(page: Page): Promise<InteractionTestResult> {
	const id = 'test-search';
	const name = 'Search functionality';
	const startedAt = Date.now();

	try {
		const searchSelector = [
			'input[type="search"]',
			'input[role="searchbox"]',
			'input[placeholder*="search" i]',
			'input[placeholder*="find" i]',
			'input[aria-label*="search" i]',
		].join(', ');

		const searchInput = await page.$(searchSelector);
		if (!searchInput) {
			return makeResult(id, name, 'skip', startedAt, 'No search input found on this page');
		}

		const isVisible = await searchInput.isVisible();
		if (!isVisible) {
			return makeResult(id, name, 'skip', startedAt, 'Search input exists but is not visible');
		}

		const beforeCount = await page.evaluate(
			() => document.querySelectorAll('[role="option"], [class*="suggestion"], [class*="autocomplete"] li').length,
		);

		// Type — do NOT press Enter (would navigate and destroy execution context)
		await searchInput.fill('test');
		await page.waitForTimeout(1_200);

		const afterCount = await page.evaluate(
			() => document.querySelectorAll('[role="option"], [class*="suggestion"], [class*="autocomplete"] li').length,
		);

		const dropdownVisible = await page.evaluate(() => {
			return [
				'[role="listbox"]',
				'[class*="dropdown"]:not([class*="nav"])',
				'[class*="suggestion"]',
				'[class*="autocomplete"]',
			].some((sel) => {
				const el = document.querySelector(sel);
				return el && el.getBoundingClientRect().height > 0;
			});
		});

		if (dropdownVisible || afterCount > beforeCount) {
			return makeResult(id, name, 'pass', startedAt, 'Search shows live suggestions');
		}

		// Search might require full submission — at least verify the input accepts input
		const inputValue = await searchInput.inputValue();
		if (inputValue === 'test') {
			return makeResult(id, name, 'pass', startedAt, 'Search input accepts text (submit not tested to avoid navigation)');
		}

		return makeResult(id, name, 'fail', startedAt, 'Search input found but produced no suggestions after typing.');
	} catch (error) {
		return makeResult(id, name, 'error', startedAt, error instanceof Error ? error.message : 'test error');
	}
}

// ─── Test 4: Primary CTA reachability ────────────────────────────────────────
//
// Uses Node.js HEAD fetch — no browser navigation.

async function testPrimaryCtaReachability(
	page: Page,
	pageUrl: string,
): Promise<InteractionTestResult> {
	const id = 'test-primary-cta';
	const name = 'Primary CTA reachability';
	const startedAt = Date.now();

	try {
		const ctaData = await page.evaluate(() => {
			const selectors = [
				'[class*="hero"] a[href]',
				'[class*="banner"] a[href]',
				'[class*="cta"] a[href]',
				'header a.btn, header a.button',
				'a[class*="btn-primary"]',
				'a[class*="button-primary"]',
				'.hero a[href]',
			];

			for (const sel of selectors) {
				const el = document.querySelector<HTMLAnchorElement>(sel);
				if (!el) continue;
				const rect = el.getBoundingClientRect();
				const style = window.getComputedStyle(el);
				const visible =
					rect.width > 0 &&
					rect.height > 0 &&
					style.visibility !== 'hidden' &&
					style.display !== 'none';
				if (!visible) continue;
				return { href: el.getAttribute('href'), text: el.innerText.trim().slice(0, 80) };
			}
			return null;
		});

		if (!ctaData?.href) {
			return makeResult(id, name, 'skip', startedAt, 'No prominent CTA link found above the fold');
		}

		let absoluteHref: string;
		try {
			absoluteHref = new URL(ctaData.href, pageUrl).toString();
		} catch {
			return makeResult(id, name, 'skip', startedAt, `Cannot resolve CTA href: ${ctaData.href}`);
		}

		// External links — skip
		if (new URL(absoluteHref).origin !== new URL(pageUrl).origin) {
			return makeResult(id, name, 'skip', startedAt, `CTA points to external site`);
		}

		const { status, ok } = await headFetch(absoluteHref);

		if (ok) {
			return makeResult(id, name, 'pass', startedAt, `CTA "${ctaData.text}" → HTTP ${status}`);
		}

		return makeResult(
			id,
			name,
			'fail',
			startedAt,
			`CTA "${ctaData.text}" → ${absoluteHref} returns HTTP ${status}. Visitors clicking the primary call-to-action will hit a broken page.`,
		);
	} catch (error) {
		return makeResult(id, name, 'error', startedAt, error instanceof Error ? error.message : 'test error');
	}
}

// ─── Test 5: Navigation link health ──────────────────────────────────────────
//
// Reuses the HEAD-check results already gathered once by collectLinks instead of
// re-fetching nav links. We only do a cheap DOM read to find which links live in
// the nav/header, then look up their status in the shared link set — no duplicate
// network requests.

async function testNavigationLinks(
	page: Page,
	links: ValidatedLink[] | null,
): Promise<InteractionTestResult> {
	const id = 'test-nav-links';
	const name = 'Navigation link health';
	const startedAt = Date.now();

	try {
		if (!links || links.length === 0) {
			return makeResult(id, name, 'skip', startedAt, 'Link health data unavailable');
		}

		// collectLinks normalises hrefs to absolute; anchor.href is also absolute.
		const statusByHref = new Map(links.map((link) => [link.href, link]));

		// Cheap DOM read (no network): which links are in the nav/header.
		const navHrefs = await page.evaluate(() =>
			Array.from(
				document.querySelectorAll<HTMLAnchorElement>('nav a[href], header a[href]'),
			)
				.map((el) => ({ href: el.href, text: el.innerText.trim().slice(0, 50) }))
				.filter(
					({ href }) =>
						href &&
						!href.startsWith('javascript:') &&
						!href.startsWith('mailto:') &&
						!href.startsWith('tel:'),
				),
		);

		const seen = new Set<string>();
		const checkedNav = navHrefs
			.filter(({ href }) => {
				if (seen.has(href)) return false;
				seen.add(href);
				return true;
			})
			.map(({ href, text }) => {
				const link = statusByHref.get(href);
				return link ? { href, text, status: link.status, ok: link.ok } : null;
			})
			.filter(
				(l): l is { href: string; text: string; status: number; ok: boolean } =>
					l !== null,
			);

		if (checkedNav.length === 0) {
			return makeResult(id, name, 'skip', startedAt, 'No checked navigation links found');
		}

		const broken = checkedNav.filter((c) => !c.ok);

		if (broken.length === 0) {
			return makeResult(id, name, 'pass', startedAt, `All ${checkedNav.length} navigation links are reachable`);
		}

		return makeResult(
			id,
			name,
			'fail',
			startedAt,
			`${broken.length} of ${checkedNav.length} nav links broken: ${broken.map((b) => `"${b.text}" (${b.status || 'no response'})`).join(', ')}`,
		);
	} catch (error) {
		return makeResult(id, name, 'error', startedAt, error instanceof Error ? error.message : 'test error');
	}
}

// ─── Test 6: Broken images ───────────────────────────────────────────────────

async function testBrokenImages(page: Page): Promise<InteractionTestResult> {
	const id = 'test-broken-images';
	const name = 'Broken images';
	const startedAt = Date.now();

	try {
		const broken = await page.evaluate(() =>
			Array.from(document.querySelectorAll<HTMLImageElement>('img'))
				.filter((img) => img.complete && img.naturalWidth === 0 && Boolean(img.getAttribute('src')))
				.map((img) => img.getAttribute('src') ?? '')
				.slice(0, 10),
		);

		if (broken.length === 0) {
			return makeResult(id, name, 'pass', startedAt, 'All images loaded successfully');
		}

		const listed = broken.slice(0, 3).join(', ');
		const extra = broken.length > 3 ? ` and ${broken.length - 3} more` : '';
		return makeResult(id, name, 'fail', startedAt, `${broken.length} image(s) failed to load: ${listed}${extra}`);
	} catch (error) {
		return makeResult(id, name, 'error', startedAt, error instanceof Error ? error.message : 'test error');
	}
}

// ─── Test 7: Tap target size ──────────────────────────────────────────────────
//
// Checks interactive elements against the 44×44 px Apple HIG / WCAG 2.5.5 minimum.
// Runs on the desktop page — element sizes are the same regardless of viewport
// because we check computed dimensions, not CSS breakpoints.

async function testTapTargetSize(page: Page): Promise<InteractionTestResult> {
	const id = 'test-tap-targets';
	const name = 'Tap target size';
	const startedAt = Date.now();
	const MIN_PX = 44;

	try {
		const small = await page.evaluate((min) => {
			const sel = 'a, button, [role="button"], input[type="submit"], input[type="button"], input[type="checkbox"], input[type="radio"]';
			return Array.from(document.querySelectorAll<HTMLElement>(sel))
				.filter((el) => {
					const rect = el.getBoundingClientRect();
					const style = window.getComputedStyle(el);
					const visible = rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
					return visible && (rect.width < min || rect.height < min);
				})
				.slice(0, 10)
				.map((el) => {
					const rect = el.getBoundingClientRect();
					return {
						tag: el.tagName.toLowerCase(),
						text: (el.textContent ?? '').trim().slice(0, 40),
						w: Math.round(rect.width),
						h: Math.round(rect.height),
					};
				});
		}, MIN_PX);

		if (small.length === 0) {
			return makeResult(id, name, 'pass', startedAt, `All interactive elements meet the ${MIN_PX}×${MIN_PX}px minimum tap target size`);
		}

		const examples = small.slice(0, 3).map((el) => `"${el.text || el.tag}" (${el.w}×${el.h}px)`).join(', ');
		const extra = small.length > 3 ? ` and ${small.length - 3} more` : '';
		return makeResult(
			id,
			name,
			'fail',
			startedAt,
			`${small.length} interactive element(s) smaller than ${MIN_PX}×${MIN_PX}px: ${examples}${extra}. Hard to tap accurately on mobile.`,
		);
	} catch (error) {
		return makeResult(id, name, 'error', startedAt, error instanceof Error ? error.message : 'test error');
	}
}

// ─── Test 8: External link security (reverse tabnapping) ─────────────────────
//
// Links with target="_blank" without rel="noopener" allow the opened page to
// access window.opener and redirect the original tab — a phishing vector.
// Derives from the link set collectLinks already read (target + rel captured per
// link) — no separate DOM pass.

function testExternalLinkSecurity(links: ValidatedLink[] | null): InteractionTestResult {
	const id = 'test-external-link-security';
	const name = 'External link security';
	const startedAt = Date.now();

	try {
		if (!links) {
			return makeResult(id, name, 'skip', startedAt, 'Link data unavailable');
		}

		const insecure = links
			.filter(
				(link) =>
					(link.target ?? '') === '_blank' &&
					!(link.rel ?? '').includes('noopener'),
			)
			.slice(0, 10);

		if (insecure.length === 0) {
			return makeResult(id, name, 'pass', startedAt, 'All new-tab links include rel="noopener"');
		}

		const examples = insecure.slice(0, 2).map((l) => `"${l.text || l.href}"`).join(', ');
		return makeResult(
			id,
			name,
			'fail',
			startedAt,
			`${insecure.length} link(s) open in a new tab without rel="noopener" — vulnerable to reverse tabnapping: ${examples}`,
		);
	} catch (error) {
		return makeResult(id, name, 'error', startedAt, error instanceof Error ? error.message : 'test error');
	}
}

// ─── Test 9: Cookie / consent banner ─────────────────────────────────────────
//
// GDPR and CCPA require a consent mechanism when the site uses tracking cookies
// or analytics. Absence is flagged as a compliance risk, not a hard failure,
// because some sites are legitimately exempt (no personal data collected).

async function testCookieBanner(page: Page): Promise<InteractionTestResult> {
	const id = 'test-cookie-banner';
	const name = 'Cookie consent banner';
	const startedAt = Date.now();

	try {
		const found = await page.evaluate(() => {
			const selectors = [
				'#onetrust-consent-sdk',
				'#cookieConsent',
				'#cookie-consent',
				'#CybotCookiebotDialog',
				'.cc-window',
				'.cookieNotice',
				'[class*="cookie-banner"]',
				'[class*="cookie-consent"]',
				'[class*="cookiebanner"]',
				'[class*="CookieBanner"]',
				'[class*="gdpr"]',
				'[id*="cookie-banner"]',
				'[id*="gdpr"]',
				'[aria-label*="cookie" i]',
				'[aria-label*="consent" i]',
			];

			for (const sel of selectors) {
				const el = document.querySelector(sel);
				if (!el) continue;
				const rect = el.getBoundingClientRect();
				const style = window.getComputedStyle(el);
				const visible = rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
				if (visible) return true;
			}
			return false;
		});

		if (found) {
			return makeResult(id, name, 'pass', startedAt, 'Cookie consent banner is present and visible');
		}

		return makeResult(
			id,
			name,
			'fail',
			startedAt,
			'No cookie consent banner detected. If this site uses analytics or tracking cookies, a GDPR/CCPA compliant consent mechanism is required.',
		);
	} catch (error) {
		return makeResult(id, name, 'error', startedAt, error instanceof Error ? error.message : 'test error');
	}
}

// ─── Test 10: Font size readability ──────────────────────────────────────────
//
// Text below 12px is effectively unreadable on most mobile screens and forces
// users to pinch-zoom. Google also flags sub-12px body text in Mobile Usability.

async function testFontSizeReadability(page: Page): Promise<InteractionTestResult> {
	const id = 'test-font-size';
	const name = 'Font size readability';
	const startedAt = Date.now();
	const MIN_PX = 12;

	try {
		const tooSmall = await page.evaluate((minPx) => {
			const elements = Array.from(document.querySelectorAll<HTMLElement>('p, li, span, td, th, label, a'));
			const found: { tag: string; text: string; size: number }[] = [];

			for (const el of elements) {
				if (found.length >= 10) break;
				const text = (el.textContent ?? '').trim();
				if (text.length < 3) continue;
				const rect = el.getBoundingClientRect();
				const style = window.getComputedStyle(el);
				if (rect.width === 0 || rect.height === 0 || style.display === 'none' || style.visibility === 'hidden') continue;
				const size = parseFloat(style.fontSize);
				if (size < minPx) found.push({ tag: el.tagName.toLowerCase(), text: text.slice(0, 40), size });
			}
			return found;
		}, MIN_PX);

		if (tooSmall.length === 0) {
			return makeResult(id, name, 'pass', startedAt, `All visible text is at least ${MIN_PX}px`);
		}

		const examples = tooSmall.slice(0, 2).map((r) => `"${r.text}" (${r.size}px)`).join(', ');
		return makeResult(
			id,
			name,
			'fail',
			startedAt,
			`${tooSmall.length} text element(s) below ${MIN_PX}px — unreadable on mobile without zoom: ${examples}`,
		);
	} catch (error) {
		return makeResult(id, name, 'error', startedAt, error instanceof Error ? error.message : 'test error');
	}
}

// ─── Test 11: Above-the-fold CTA visibility ───────────────────────────────────
//
// Complements testPrimaryCtaReachability: that test checks the link resolves.
// This test checks whether the CTA is actually visible without scrolling.
// A CTA below the fold on a 900px viewport is invisible to users on first load.

async function testAboveFoldCta(page: Page): Promise<InteractionTestResult> {
	const id = 'test-above-fold-cta';
	const name = 'Above-the-fold CTA visibility';
	const startedAt = Date.now();

	try {
		const result = await page.evaluate(() => {
			const selectors = [
				'[class*="hero"] a[href]',
				'[class*="banner"] a[href]',
				'[class*="cta"] a[href]',
				'header a.btn, header a.button',
				'a[class*="btn-primary"]',
				'a[class*="button-primary"]',
				'.hero a[href]',
			];

			for (const sel of selectors) {
				const el = document.querySelector<HTMLAnchorElement>(sel);
				if (!el) continue;
				const rect = el.getBoundingClientRect();
				const style = window.getComputedStyle(el);
				const visible = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
				if (!visible) continue;
				return {
					found: true as const,
					aboveFold: rect.top < window.innerHeight && rect.bottom > 0,
					text: (el.textContent ?? '').trim().slice(0, 60),
					top: Math.round(rect.top),
					vh: window.innerHeight,
				};
			}
			return { found: false as const };
		});

		if (!result.found) {
			return makeResult(id, name, 'skip', startedAt, 'No primary CTA found on this page');
		}

		if (result.aboveFold) {
			return makeResult(id, name, 'pass', startedAt, `CTA "${result.text}" is visible above the fold`);
		}

		return makeResult(
			id,
			name,
			'fail',
			startedAt,
			`CTA "${result.text}" is ${result.top}px from the top — below the ${result.vh}px viewport height. Users must scroll to find the main action.`,
		);
	} catch (error) {
		return makeResult(id, name, 'error', startedAt, error instanceof Error ? error.message : 'test error');
	}
}

// ─── Test 12: Cumulative Layout Shift (CLS) ───────────────────────────────────
//
// Chromium stores LayoutShift entries in the performance buffer automatically —
// no pre-injected observer needed. We read them after page load and sum the
// values that weren't triggered by user input (the standard CLS definition).
// Threshold: 0.1 = Google "good", 0.25 = Google "poor".

async function testLayoutShift(page: Page): Promise<InteractionTestResult> {
	const id = 'test-cls';
	const name = 'Layout shift (CLS)';
	const startedAt = Date.now();
	const GOOD = 0.1;
	const POOR = 0.25;

	try {
		const cls = await page.evaluate(() => {
			const entries = performance.getEntriesByType('layout-shift');
			return entries.reduce((sum, entry) => {
				const shift = entry as unknown as { value: number; hadRecentInput: boolean };
				return sum + (shift.hadRecentInput ? 0 : shift.value);
			}, 0);
		});

		const score = Math.round(cls * 1000) / 1000;

		if (score <= GOOD) {
			return makeResult(id, name, 'pass', startedAt, `CLS score ${score} — good (below ${GOOD})`);
		}

		if (score <= POOR) {
			return makeResult(
				id,
				name,
				'fail',
				startedAt,
				`CLS score ${score} needs improvement (threshold ${GOOD}). Elements shift after load. Common causes: images without dimensions, late-loading fonts, injected banners.`,
			);
		}

		return makeResult(
			id,
			name,
			'fail',
			startedAt,
			`CLS score ${score} is poor (above ${POOR}). Significant layout instability — users frequently click the wrong element. Hurts Google Core Web Vitals ranking.`,
		);
	} catch (error) {
		return makeResult(id, name, 'error', startedAt, error instanceof Error ? error.message : 'test error');
	}
}

// ─── Test 13: Placeholder / lorem-ipsum text ─────────────────────────────────

async function testPlaceholderText(page: Page): Promise<InteractionTestResult> {
	const id = 'test-placeholder-text';
	const name = 'Placeholder / dummy text';
	const startedAt = Date.now();
	const PATTERNS = ['lorem ipsum', 'coming soon', 'placeholder', 'sample text', 'your text here', 'todo', 'fixme'];

	try {
		const found = await page.evaluate((patterns) => {
			const body = (document.body?.innerText ?? '').toLowerCase();
			return patterns.filter((p) => body.includes(p));
		}, PATTERNS);

		if (found.length === 0)
			return makeResult(id, name, 'pass', startedAt, 'No placeholder text detected');

		return makeResult(id, name, 'fail', startedAt,
			`Placeholder text found on page: "${found.slice(0, 3).join('", "')}". Looks unfinished to visitors.`);
	} catch (error) {
		return makeResult(id, name, 'error', startedAt, error instanceof Error ? error.message : 'test error');
	}
}

// ─── Test 14: Missing legal links ────────────────────────────────────────────

async function testLegalLinks(page: Page): Promise<InteractionTestResult> {
	const id = 'test-missing-legal-links';
	const name = 'Legal links (Privacy / Terms)';
	const startedAt = Date.now();

	try {
		const { hasPrivacy, hasTerms } = await page.evaluate(() => {
			const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
				.map((a) => a.innerText.toLowerCase());
			const bodyText = document.body.innerText.toLowerCase();
			return {
				hasPrivacy: links.some((t) => t.includes('privacy')) || bodyText.includes('privacy policy'),
				hasTerms:   links.some((t) => t.includes('terms'))   || bodyText.includes('terms of service') || bodyText.includes('terms & conditions'),
			};
		});

		const missing: string[] = [];
		if (!hasPrivacy) missing.push('Privacy Policy');
		if (!hasTerms)   missing.push('Terms of Service');

		if (missing.length === 0)
			return makeResult(id, name, 'pass', startedAt, 'Privacy Policy and Terms of Service links present');

		return makeResult(id, name, 'fail', startedAt,
			`Missing legal page link(s): ${missing.join(', ')}. Required for GDPR compliance and visitor trust.`);
	} catch (error) {
		return makeResult(id, name, 'error', startedAt, error instanceof Error ? error.message : 'test error');
	}
}

// ─── Test 15: Stale copyright year ───────────────────────────────────────────

async function testStaleCopyright(page: Page): Promise<InteractionTestResult> {
	const id = 'test-stale-copyright';
	const name = 'Stale copyright year';
	const startedAt = Date.now();
	const currentYear = new Date().getFullYear();

	try {
		const copyrightYear = await page.evaluate(() => {
			const text = document.body?.innerText ?? '';
			const match = text.match(/©\s*(\d{4})/);
			return match ? parseInt(match[1], 10) : null;
		});

		if (copyrightYear === null)
			return makeResult(id, name, 'skip', startedAt, 'No copyright year found');

		if (currentYear - copyrightYear <= 1)
			return makeResult(id, name, 'pass', startedAt, `Copyright year ${copyrightYear} is current`);

		return makeResult(id, name, 'fail', startedAt,
			`Copyright shows © ${copyrightYear} — ${currentYear - copyrightYear} year(s) out of date. Makes the site look abandoned and unmaintained.`);
	} catch (error) {
		return makeResult(id, name, 'error', startedAt, error instanceof Error ? error.message : 'test error');
	}
}

// ─── Test 16: Phone / email not tappable ─────────────────────────────────────

async function testTappableContacts(page: Page): Promise<InteractionTestResult> {
	const id = 'test-tappable-contacts';
	const name = 'Tappable phone & email links';
	const startedAt = Date.now();

	try {
		const issues = await page.evaluate(() => {
			const phoneRe = /(\+?\d[\d\s\-(). ]{7,}\d)/g;
			const emailRe = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
			const bad: string[] = [];

			document.querySelectorAll<HTMLElement>('p, li, span, div, footer, address').forEach((el) => {
				if (el.closest('a')) return;
				// Only check direct text content, not full innerHTML
				const text = Array.from(el.childNodes)
					.filter((n) => n.nodeType === Node.TEXT_NODE)
					.map((n) => n.textContent ?? '')
					.join('');
				if (phoneRe.test(text)) bad.push(`Phone not linked: "${text.trim().slice(0, 40)}"`);
				phoneRe.lastIndex = 0;
				if (emailRe.test(text)) bad.push(`Email not linked: "${text.trim().slice(0, 40)}"`);
				emailRe.lastIndex = 0;
			});
			return bad.slice(0, 4);
		});

		if (issues.length === 0)
			return makeResult(id, name, 'pass', startedAt, 'All phone numbers and emails are tappable links');

		return makeResult(id, name, 'fail', startedAt,
			`${issues.length} contact detail(s) are plain text — mobile visitors cannot tap to call or email. ${issues[0]}`);
	} catch (error) {
		return makeResult(id, name, 'error', startedAt, error instanceof Error ? error.message : 'test error');
	}
}

// ─── Test 17: Dead social media links ────────────────────────────────────────

async function testSocialLinks(page: Page): Promise<InteractionTestResult> {
	const id = 'test-social-links';
	const name = 'Social media link health';
	const startedAt = Date.now();
	const SOCIAL_DOMAINS = ['facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'linkedin.com', 'youtube.com', 'tiktok.com'];

	try {
		const links = await page.evaluate((domains) =>
			Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
				.filter((a) => domains.some((d) => (a.getAttribute('href') ?? '').includes(d)))
				.map((a) => ({ href: a.getAttribute('href') ?? '', text: a.innerText.trim().slice(0, 30) })),
			SOCIAL_DOMAINS,
		);

		if (links.length === 0)
			return makeResult(id, name, 'skip', startedAt, 'No social media links found');

		const dead = links.filter((l) =>
			l.href === '#' ||
			/^https?:\/\/(www\.)?(facebook|twitter|x|instagram|linkedin|youtube|tiktok)\.com\/?$/.test(l.href),
		);

		if (dead.length === 0)
			return makeResult(id, name, 'pass', startedAt, `${links.length} social link(s) appear to point to real profiles`);

		return makeResult(id, name, 'fail', startedAt,
			`${dead.length} social link(s) point to a domain root or placeholder — no real profile linked: ${dead.map((l) => l.href).join(', ')}`);
	} catch (error) {
		return makeResult(id, name, 'error', startedAt, error instanceof Error ? error.message : 'test error');
	}
}

// ─── Test 18: Favicon presence ───────────────────────────────────────────────

async function testFavicon(page: Page): Promise<InteractionTestResult> {
	const id = 'test-favicon';
	const name = 'Favicon presence';
	const startedAt = Date.now();

	try {
		const has = await page.evaluate(() =>
			!!(
				document.querySelector('link[rel="icon"]') ||
				document.querySelector('link[rel="shortcut icon"]') ||
				document.querySelector('link[rel="apple-touch-icon"]')
			),
		);

		if (has)
			return makeResult(id, name, 'pass', startedAt, 'Favicon is present');

		return makeResult(id, name, 'fail', startedAt,
			'No favicon found. Browser tabs show a blank icon, making the site look unfinished and hard to identify when users have multiple tabs open.');
	} catch (error) {
		return makeResult(id, name, 'error', startedAt, error instanceof Error ? error.message : 'test error');
	}
}

// ─── Main collector ───────────────────────────────────────────────────────────

/**
 * Run all interaction tests on the already-navigated page.
 *
 * KEY RULE: no test may call page.goto() or navigate the browser page.
 * Navigation destroys the Playwright execution context and crashes parallel
 * collectors (axe, seo, links) that are running in Promise.allSettled.
 *
 * 404 detection and CTA/nav link checks use Node.js fetch() instead.
 * Search test types into the input but does NOT press Enter.
 */
export async function collectInteractionTests(
	page: Page,
	pageUrl: string,
	timing?: { scanId?: string; pageUrl?: string },
	opts?: { linksPromise?: Promise<LinksResult | undefined> },
): Promise<InteractionTestsPayload> {
	const startedAt = Date.now();
	const results: InteractionTestResult[] = [];

	const runTest = async (test: () => Promise<InteractionTestResult>) => {
		try {
			results.push(await test());
		} catch (error) {
			results.push({
				id: 'unknown',
				name: 'Unknown test',
				status: 'error',
				detail: error instanceof Error ? error.message : 'unexpected error',
				durationMs: 0,
			});
		}
	};

	// Tests that don't depend on the link health set. Run these first so the
	// shared collectLinks pass (running concurrently as its own collector) is
	// resolved by the time we reach the link-dependent checks below.
	const independentTests: Array<() => Promise<InteractionTestResult>> = [
		() => test404Page(pageUrl),                          // fetch only — distinct fake URL
		() => testFormValidation(page),                      // click only — no navigation
		() => testSearchFunctionality(page),                 // type only — no Enter key
		() => testPrimaryCtaReachability(page, pageUrl),     // fetch only — no navigation
		() => testBrokenImages(page),
		() => testTapTargetSize(page),
		() => testCookieBanner(page),
		() => testFontSizeReadability(page),
		() => testAboveFoldCta(page),
		() => testLayoutShift(page),
		() => testPlaceholderText(page),
		() => testLegalLinks(page),
		() => testStaleCopyright(page),
		() => testTappableContacts(page),
		() => testSocialLinks(page),
		() => testFavicon(page),
	];

	for (const test of independentTests) {
		await runTest(test);
	}

	// Link-dependent checks reuse the HEAD-check results + target/rel attributes
	// from collectLinks (computed once) rather than re-fetching / re-reading.
	const linksResult = opts?.linksPromise
		? await opts.linksPromise.catch(() => undefined)
		: undefined;
	const links = linksResult?.links ?? null;

	await runTest(() => testNavigationLinks(page, links));
	await runTest(async () => testExternalLinkSecurity(links));

	const durationMs = Date.now() - startedAt;
	const testsFailed = results.filter((r) => r.status === 'fail').length;

	logScanTiming('interaction_tests', durationMs, {
		...timing,
		ok: true,
		testsRun: results.length,
		testsFailed,
		results: results.map((r) => ({ id: r.id, status: r.status })),
	});

	return { results, durationMs, testsRun: results.length, testsFailed };
}
