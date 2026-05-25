import type { Page, Route } from 'playwright-core';

// Third-party domains that slow navigation and prevent networkidle from settling.
const BLOCKED_RESOURCE_PATTERNS = [
	'google-analytics.com',
	'googletagmanager.com',
	'analytics.google.com',
	'hotjar.com',
	'clarity.ms',
	'segment.io',
	'segment.com',
	'mixpanel.com',
	'amplitude.com',
	'heap.io',
	'fullstory.com',
	'logrocket.com',
	'doubleclick.net',
	'googlesyndication.com',
	'adservice.google.com',
	'amazon-adsystem.com',
	'facebook.com/tr',
	'connect.facebook.net',
	'intercom.io',
	'intercomcdn.com',
	'crisp.chat',
	'tawk.to',
	'drift.com',
	'livechat.com',
	'cookiebot.com',
	'onetrust.com',
	'youtube.com/embed',
	'vimeo.com/video',
] as const;

function escapeRegExp(pattern: string): string {
	return pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const BLOCKED_URL_PATTERN = new RegExp(
	BLOCKED_RESOURCE_PATTERNS.map(escapeRegExp).join('|'),
);

/** Block heavy third-party requests before navigation. Non-fatal on failure. */
export async function blockThirdPartyResources(page: Page): Promise<void> {
	try {
		await page.route(BLOCKED_URL_PATTERN, (route: Route) => {
			void route.abort();
		});
	} catch {
		// Non-fatal — scan proceeds without resource blocking
	}
}
