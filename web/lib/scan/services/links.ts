import { createConcurrencyLimit } from '@/lib/utils/concurrency-limit';
import type { BrowserContext, Page } from 'playwright-core';
import type { LinkRecord, ScanResult, ValidatedLink } from '../types/scan.types';
import { cleanError } from './navigation';
import { logScanTiming } from './scan-timing';

// Reduced from 50 → 30: covers all meaningful navigation links without long tail
// of footer/social links that rarely produce actionable broken-link findings.
const MAX_LINKS = 30;
// Reduced from 3 s → 2 s: genuine broken links time-out quickly; slow-but-alive
// servers either respond in <2 s or aren't worth blocking the scan for.
const LINK_TIMEOUT = 2_000;
// True sliding-window concurrency: next link starts the moment any slot frees,
// rather than waiting for the slowest link in a fixed batch.
const LINK_CONCURRENCY = 25;

// Send the full set of headers a real Chrome sends, not just a UA string. Many
// bot-defended sites (Upwork, Toptal, LinkedIn, Cloudflare-fronted hosts) return
// 403 to bare script requests that lack Accept / Accept-Language / Sec-Fetch
// headers, even though the link works perfectly in a real browser. Looking like a
// genuine navigation is the cheapest way to avoid those false-positive 403s.
const FETCH_HEADERS = {
	'User-Agent':
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
	Accept:
		'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
	'Accept-Language': 'en-US,en;q=0.9',
	'Sec-Fetch-Dest': 'document',
	'Sec-Fetch-Mode': 'navigate',
	'Sec-Fetch-Site': 'none',
	'Upgrade-Insecure-Requests': '1',
};

// 403 is the classic signature of bot-blocking, not a genuinely missing page (that
// is 404). Before reporting any 403 as broken we re-verify it with the real
// headless browser. Each re-verification is a full navigation (seconds), so we cap
// how many we run per page and log when the cap is hit rather than silently
// dropping the rest.
const BROWSER_VERIFY_TIMEOUT = 8_000;
const MAX_BROWSER_REVERIFY = 8;
const BROWSER_VERIFY_CONCURRENCY = 2;

function normalizeLink(baseUrl: string, href: string): string | null {
	try {
		return new URL(href, baseUrl).href;
	} catch {
		return null;
	}
}

/** Same registrable host ignoring leading `www.` (apex ↔ www, not subdomains). */
function isSameSiteLoose(pageOrigin: string, absoluteHref: string): boolean {
	try {
		const base = new URL(pageOrigin);
		const target = new URL(absoluteHref);
		if (base.protocol !== target.protocol) return false;
		const norm = (host: string) => {
			const h = host.toLowerCase();
			return h.startsWith('www.') ? h.slice(4) : h;
		};
		return norm(base.hostname) === norm(target.hostname);
	} catch {
		return false;
	}
}

async function requestWithTimeout(url: string, method: 'HEAD' | 'GET') {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), LINK_TIMEOUT);

	try {
		const response = await fetch(url, {
			method,
			signal: controller.signal,
			redirect: 'follow',
			headers: FETCH_HEADERS,
		});
		return { status: response.status, ok: response.ok };
	} finally {
		clearTimeout(timeout);
	}
}

async function validateLink(link: LinkRecord): Promise<ValidatedLink> {
	try {
		let response = await requestWithTimeout(link.href, 'HEAD');

		// Retry with GET when HEAD is rejected. 405/501 = method not supported;
		// 403 is frequently a HEAD-specific block on servers that serve GET fine.
		if (
			response.status === 405 ||
			response.status === 501 ||
			response.status === 403
		) {
			response = await requestWithTimeout(link.href, 'GET');
		}

		return { ...link, status: response.status, ok: response.ok };
	} catch (error) {
		return { ...link, status: 0, ok: false, error: cleanError(error) };
	}
}

/**
 * Re-verify a link by actually navigating to it in the real headless browser.
 * Used only for 403 responses, which are usually bot-blocking rather than a
 * genuinely broken link. A real navigation sends the full browser fingerprint
 * (headers, TLS, JS) that a `fetch` cannot, so a link that loads here is fine.
 * Returns null when the navigation itself fails (timeout / DNS / connection) so
 * the caller keeps the original 403 verdict instead of clearing it.
 */
async function verifyLinkInBrowser(
	context: BrowserContext,
	url: string,
): Promise<{ status: number; ok: boolean } | null> {
	let probe: Page | null = null;
	try {
		probe = await context.newPage();
		const response = await probe.goto(url, {
			waitUntil: 'domcontentloaded',
			timeout: BROWSER_VERIFY_TIMEOUT,
		});
		if (!response) return null;
		const status = response.status();
		return { status, ok: status < 400 };
	} catch {
		return null;
	} finally {
		if (probe) await probe.close().catch(() => {});
	}
}

export async function collectLinks(
	page: Page,
	pageUrl: string,
	timing?: { scanId?: string; pageUrl?: string },
): Promise<NonNullable<ScanResult['links']>> {
	const startedAt = Date.now();
	const rawLinks = await page.evaluate(() => {
		const origin = window.location.origin;

		return Array.from(document.querySelectorAll('a[href]'))
			.map((node) => {
				const anchor = node as HTMLAnchorElement;
				const href = anchor.getAttribute('href')?.trim() ?? '';

				if (
					!href ||
					href.startsWith('#') ||
					href.startsWith('javascript:') ||
					href.startsWith('mailto:') ||
					href.startsWith('tel:')
				) {
					return null;
				}

				return {
					href,
					text: anchor.innerText.trim().slice(0, 100),
					target: anchor.getAttribute('target'),
					rel: anchor.getAttribute('rel'),
					origin,
				};
			})
			.filter(Boolean) as Array<{
			href: string;
			text: string;
			target: string | null;
			rel: string | null;
			origin: string;
		}>;
	});

	const normalizedLinks = rawLinks
		.map((link): LinkRecord | null => {
			const href = normalizeLink(pageUrl, link.href);
			if (!href) return null;

			return {
				href,
				text: link.text,
				target: link.target,
				rel: link.rel,
				isExternal: !isSameSiteLoose(link.origin, href),
			};
		})
		.filter((link): link is LinkRecord => link !== null);

	const uniqueLinks: LinkRecord[] = Array.from(
		new Map(normalizedLinks.map((link) => [link.href, link])).values(),
	);

	const checkedLinks = uniqueLinks.slice(0, MAX_LINKS);

	// p-limit gives a true sliding window: the next link starts the moment any
	// slot frees, unlike a batch loop that waits for the slowest link per batch.
	const limit = createConcurrencyLimit(LINK_CONCURRENCY);
	const validatedLinks = await Promise.all(
		checkedLinks.map((link) => limit(() => validateLink(link))),
	);

	// Re-verify 403s with the real browser before trusting them as broken (see
	// MAX_BROWSER_REVERIFY). 403 ≠ 404: it usually means "bot blocked", not "gone".
	const suspicious = validatedLinks.filter(
		(link) => !link.ok && link.status === 403,
	);
	if (suspicious.length > 0) {
		const context = page.context();
		const toVerify = suspicious.slice(0, MAX_BROWSER_REVERIFY);
		if (suspicious.length > toVerify.length) {
			console.warn('[links] 403 re-verification cap hit', {
				pageUrl,
				suspicious: suspicious.length,
				verified: toVerify.length,
				note: 'Remaining 403s are reported as broken without browser re-check.',
			});
		}
		const verifyLimit = createConcurrencyLimit(BROWSER_VERIFY_CONCURRENCY);
		await Promise.all(
			toVerify.map((link) =>
				verifyLimit(async () => {
					const verified = await verifyLinkInBrowser(context, link.href);
					// Only clear the broken verdict when the browser actually loaded it.
					// A failed/null probe leaves the original 403 in place.
					if (verified) {
						link.status = verified.status;
						link.ok = verified.ok;
					}
				}),
			),
		);
	}

	const result = {
		totalLinks: uniqueLinks.length,
		checkedLinks: validatedLinks.length,
		brokenLinks: validatedLinks.filter((link) => !link.ok),
		links: validatedLinks,
	};

	logScanTiming('links', Date.now() - startedAt, {
		...timing,
		pageUrl,
		ok: true,
		totalLinks: result.totalLinks,
		checkedLinks: result.checkedLinks,
		brokenLinks: result.brokenLinks.length,
	});

	return result;
}
