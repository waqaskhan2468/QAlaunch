import { createConcurrencyLimit } from '@/lib/utils/concurrency-limit';
import type { Page } from 'playwright-core';
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

// Mimic a real browser UA so servers don't 403/reject HEAD requests from scripts.
const FETCH_HEADERS = {
	'User-Agent':
		'Mozilla/5.0 (compatible; QAlaunch-LinkChecker/1.0; +https://qalaunch.com)',
};

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

		if (response.status === 405 || response.status === 501) {
			response = await requestWithTimeout(link.href, 'GET');
		}

		return { ...link, status: response.status, ok: response.ok };
	} catch (error) {
		return { ...link, status: 0, ok: false, error: cleanError(error) };
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
