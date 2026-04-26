import type { Page } from 'playwright';
import type {
	LinkRecord,
	ScanResult,
	ValidatedLink,
} from '../types/scan.types';
import { cleanError } from './navigation';

const MAX_LINKS = 50;
const LINK_TIMEOUT = 3_000;

function normalizeLink(baseUrl: string, href: string): string | null {
	try {
		return new URL(href, baseUrl).href;
	} catch {
		return null;
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
		return {
			...link,
			status: 0,
			ok: false,
			error: cleanError(error),
		};
	}
}

export async function collectLinks(
	page: Page,
	pageUrl: string,
): Promise<NonNullable<ScanResult['links']>> {
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
				isExternal: !href.startsWith(link.origin),
			};
		})
		.filter((link): link is LinkRecord => link !== null);

	const uniqueLinks = Array.from(
		new Map(normalizedLinks.map((link) => [link.href, link])).values(),
	);

	const checkedLinks = uniqueLinks.slice(0, MAX_LINKS);
	const validatedLinks = await Promise.all(checkedLinks.map(validateLink));

	return {
		totalLinks: uniqueLinks.length,
		checkedLinks: validatedLinks.length,
		brokenLinks: validatedLinks.filter((link) => !link.ok),
		links: validatedLinks,
	};
}
