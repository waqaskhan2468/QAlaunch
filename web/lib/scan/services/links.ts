import { createConcurrencyLimit } from '@/lib/utils/concurrency-limit';
import type { BrowserContext, Page } from 'playwright-core';
import type { LinkRecord, ScanResult, ValidatedLink } from '../types/scan.types';
import { cleanError } from './navigation';
import { logScanTiming } from './scan-timing';

// Reduced from 50 → 30: covers all meaningful navigation links without long tail
// of footer/social links that rarely produce actionable broken-link findings.
const MAX_LINKS = 30;
// 8 s, raised from 2 s. The old "slow-but-alive servers respond in <2 s" assumption
// was wrong: real origins (e.g. slow WordPress/Webflow hosts) routinely take 2–9 s to
// answer a HEAD/GET yet return HTTP 200. A 2 s abort turned every such link into a
// status-0 false-positive "broken" verdict. 8 s covers those slow-but-alive responses
// while still failing genuinely dead links quickly (links run concurrently, so the
// per-link ceiling rarely moves the wall-clock on healthy sites).
const LINK_TIMEOUT = 8_000;
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

// Two fetch verdicts are too weak to trust on their own, so we re-verify them with
// a real headless-browser navigation (the source of truth) before reporting broken:
//   • 403 — the classic bot-blocking signature, not a missing page (that is 404).
//   • status 0 — HEAD *and* GET both timed out / errored. On pathologically slow
//     origins a live page can exceed even the 8 s fetch ceiling on both methods, so
//     a 0 is "couldn't confirm", not "confirmed broken".
// Each re-verification is a full navigation (seconds), so we cap how many we run per
// page and log when the cap is hit rather than silently dropping the rest. The
// timeout is generous because the whole reason we land here is a slow-but-alive host.
const BROWSER_VERIFY_TIMEOUT = 15_000;
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
	} catch (headError) {
		// HEAD threw (timeout / connection reset / refused). On slow origins HEAD is
		// frequently SLOWER than GET — or blocked outright — so a HEAD failure is a
		// weak "broken" signal. A genuinely missing page returns a status code (404),
		// it does not throw. Retry once with GET before giving up; only record
		// status 0 (truly unreachable) when GET also throws.
		try {
			const response = await requestWithTimeout(link.href, 'GET');
			return { ...link, status: response.status, ok: response.ok };
		} catch (getError) {
			return { ...link, status: 0, ok: false, error: cleanError(getError) };
		}
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

	// Re-verify 403s and timeouts (status 0) with the real browser before trusting
	// them as broken (see MAX_BROWSER_REVERIFY). 403 ≠ 404 (usually "bot blocked",
	// not "gone"); status 0 = "fetch couldn't confirm" (slow-but-alive host), not
	// "confirmed broken". A real navigation sends the full browser fingerprint and
	// tolerates a slower response, so a page that loads here is fine.
	const suspicious = validatedLinks.filter(
		(link) => !link.ok && (link.status === 403 || link.status === 0),
	);
	if (suspicious.length > 0) {
		const context = page.context();
		const toVerify = suspicious.slice(0, MAX_BROWSER_REVERIFY);
		if (suspicious.length > toVerify.length) {
			console.warn('[links] browser re-verification cap hit', {
				pageUrl,
				suspicious: suspicious.length,
				verified: toVerify.length,
				note: 'Remaining suspicious links are reported as broken without browser re-check.',
			});
		}
		const verifyLimit = createConcurrencyLimit(BROWSER_VERIFY_CONCURRENCY);
		await Promise.all(
			toVerify.map((link) =>
				verifyLimit(async () => {
					const verified = await verifyLinkInBrowser(context, link.href);
					// Only clear the broken verdict when the browser actually loaded it.
					// A failed/null probe leaves the original verdict (403 / status 0) in place.
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
