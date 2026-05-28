import type { Page, Route } from 'playwright-core';

// Third-party domains that slow navigation and prevent networkidle from settling.
const BLOCKED_RESOURCE_PATTERNS = [
	// Analytics & tag managers
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
	// Ads
	'doubleclick.net',
	'googlesyndication.com',
	'adservice.google.com',
	'amazon-adsystem.com',
	// Social pixels & tracking
	'facebook.com/tr',
	'connect.facebook.net',
	'analytics.tiktok.com',   // TikTok pixel
	'static.ads-twitter.com', // X / Twitter ads pixel
	'snap.licdn.com',          // LinkedIn Insight Tag
	'alb.reddit.com',          // Reddit pixel
	'ct.pinterest.com',        // Pinterest tag
	// Marketing automation (tracking scripts, not page content)
	'js.hs-scripts.com',       // HubSpot tracking
	'js.hubspot.com',
	'klaviyo.com',             // Klaviyo on-site scripts
	// Live chat & support widgets
	'intercom.io',
	'intercomcdn.com',
	'crisp.chat',
	'tawk.to',
	'drift.com',
	'livechat.com',
	// Consent banners
	'cookiebot.com',
	'onetrust.com',
	// Embeds (video players — layout still renders without them)
	'youtube.com/embed',
	'vimeo.com/video',
	'fast.wistia.net',         // Wistia video CDN
	// Error tracking & APM (can fire large payloads mid-scan)
	'sentry.io',
	'browser.sentry-cdn.com',
	'bugsnag.com',
	'rollbar.com',
	'nr-data.net',
	'newrelic.com',
	'datadoghq.com',
	'browser-intake-datadoghq.com',
	'rum-static.pingdom.net',  // Pingdom RUM
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
