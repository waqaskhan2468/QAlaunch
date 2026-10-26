import * as cheerio from 'cheerio';
import { Agent, fetch as undiciFetch } from 'undici';

import { detectWebAppGate } from '@/lib/utils/detect';

/**
 * Pre-scan validation gate. Runs server-side after a URL is submitted but
 * before any scan is queued (free or paid). It performs a short, single-attempt
 * homepage fetch and reuses the existing strict web-app detection so the
 * caller can:
 *   - reject genuinely unreachable targets (DNS failure, connection refused,
 *     TLS error, timeout — i.e. no HTTP response at all), and
 *   - flag homepages that are a login/sign-up form or an authenticated app
 *     shell (so only public-facing pages are ever scanned).
 *
 * It does NOT touch the Inngest pipeline — `detectAndSelectPages` still runs
 * its own fetch + detection inside the job. This is a fast front-door check.
 *
 * IMPORTANT: "reachable" is defined as "the host returned an HTTP response",
 * NOT "the host returned 2xx HTML". Many legitimate sites sit behind a
 * Cloudflare/bot-protection JS challenge that answers a plain `fetch` with a
 * 403/503 "Just a moment…" page (header `cf-mitigated: challenge`). Those
 * sites load fine in a real browser, and the actual scan runs in a full
 * headless browser (Browserbase/Playwright) that can pass such challenges —
 * so a non-2xx status must NOT be treated as unreachable here, or we'd reject
 * a large fraction of the web. We can't analyse a challenge/error page for the
 * web-app gate, so those simply proceed as a normal (non-web-app) site.
 */

// Short ceiling: this blocks a synchronous submit, so we fail fast rather than
// using the long (25s × 2) crawl-time budget.
const GATE_TIMEOUT_MS = 10_000;
const GATE_CONNECT_TIMEOUT_MS = 10_000;

// Realistic current desktop Chrome UA. Plain "bot" user-agents are blocked
// outright by many WordPress hosts / CDNs / WAFs, so we present as a browser.
const BROWSER_USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const gateFetchAgent = new Agent({ connectTimeout: GATE_CONNECT_TIMEOUT_MS });

export type ScanTargetValidation =
	| { status: 'unreachable' }
	| { status: 'editor_url'; platform: string; hint: string }
	| { status: 'ok'; isWebApp: boolean };

/**
 * Editor, preview and dashboard links from the AI builders this product is
 * marketed to. 19 of the 59 failed scans in the admin console were
 * "login-gated", and a good share of those were someone pasting the link in
 * their editor's address bar (app.base44.com/apps/…/editor/preview, a Lovable
 * project page, a Vercel dashboard) rather than their published site. Those
 * people HAVE a public site; the message just has to say where to find it.
 */
const EDITOR_URL_PATTERNS: Array<{
	platform: string;
	test: (host: string, path: string) => boolean;
	hint: string;
}> = [
	{
		platform: 'Base44',
		test: (host, path) => host === 'app.base44.com' || path.includes('/editor'),
		hint: 'Publish the app in Base44, then paste the published address (yourapp.base44.app or your own domain).',
	},
	{
		platform: 'Lovable',
		test: (host) => host === 'lovable.dev' || host.endsWith('.lovable.dev'),
		hint: 'Click Publish in Lovable, then paste the published address (yourapp.lovable.app or your own domain).',
	},
	{
		platform: 'Bolt',
		test: (host) => host === 'bolt.new' || host.endsWith('.bolt.new'),
		hint: 'Deploy the project from Bolt, then paste the live address (usually a .netlify.app or .bolt.host link).',
	},
	{
		platform: 'v0',
		test: (host) => host === 'v0.dev' || host === 'v0.app',
		hint: 'Deploy the project from v0 to Vercel, then paste the deployed address.',
	},
	{
		platform: 'Replit',
		test: (host, path) => host === 'replit.com' && path.startsWith('/@'),
		hint: 'Deploy the Repl, then paste its deployment address (usually a .replit.app link).',
	},
	{
		platform: 'Vercel',
		test: (host) => host === 'vercel.com',
		hint: 'Paste the deployed site address (yourproject.vercel.app or your own domain), not the Vercel dashboard.',
	},
	{
		platform: 'Netlify',
		test: (host) => host === 'app.netlify.com',
		hint: 'Paste the deployed site address (yoursite.netlify.app or your own domain), not the Netlify dashboard.',
	},
	{
		platform: 'Shopify',
		test: (host, path) => host === 'admin.shopify.com' || path.startsWith('/admin'),
		hint: 'Paste your storefront address (yourstore.myshopify.com or your own domain), not the Shopify admin.',
	},
	{
		platform: 'WordPress',
		test: (host, path) => path.startsWith('/wp-admin') || host === 'wordpress.com' && path.startsWith('/log-in'),
		hint: 'Paste your public site address, not the WordPress admin or login page.',
	},
	{
		platform: 'Figma',
		test: (host) => host === 'www.figma.com' || host === 'figma.com',
		hint: 'A Figma file is a design, not a website. Paste the address of the site built from it.',
	},
];

export function detectEditorUrl(
	url: string,
): { platform: string; hint: string } | null {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return null;
	}
	const host = parsed.hostname.toLowerCase();
	const path = parsed.pathname.toLowerCase();
	const match = EDITOR_URL_PATTERNS.find((p) => p.test(host, path));
	return match ? { platform: match.platform, hint: match.hint } : null;
}

export function editorUrlMessage(editor: { platform: string; hint: string }): string {
	return `This looks like a ${editor.platform} editor, preview or admin link rather than your published website, so there is nothing a visitor could see here. ${editor.hint}`;
}

export async function validateScanTarget(
	url: string,
): Promise<ScanTargetValidation> {
	const editor = detectEditorUrl(url);
	if (editor) return { status: 'editor_url', ...editor };

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), GATE_TIMEOUT_MS);

	let response: Awaited<ReturnType<typeof undiciFetch>>;
	try {
		response = await undiciFetch(url, {
			signal: controller.signal as AbortSignal,
			dispatcher: gateFetchAgent,
			redirect: 'follow',
			headers: {
				'User-Agent': BROWSER_USER_AGENT,
				Accept:
					'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
				'Accept-Language': 'en-US,en;q=0.9',
			},
		} as Parameters<typeof undiciFetch>[1]);
	} catch (error) {
		// No HTTP response at all — DNS failure, connection refused/reset, TLS
		// error, or our own timeout. This is the only genuinely-unreachable case.
		const name = error instanceof Error ? error.name : 'Unknown';
		const message = error instanceof Error ? error.message : String(error);
		const cause =
			error instanceof Error && error.cause instanceof Error ?
				((error.cause as { code?: string }).code ?? error.cause.message)
			:	undefined;
		console.warn('[validate-target] unreachable (no HTTP response)', {
			url,
			name,
			message,
			cause,
		});
		return { status: 'unreachable' };
	} finally {
		clearTimeout(timeout);
	}

	// We got an HTTP response, so the host is reachable. A non-2xx status is
	// almost always a bot-protection challenge (e.g. Cloudflare 403/503) or a
	// transient error — both of which the real browser-based scan can handle.
	// Proceed, but skip web-app detection since the body isn't the real page.
	if (!response.ok) {
		console.warn('[validate-target] non-2xx response — proceeding anyway', {
			url,
			status: response.status,
			server: response.headers.get('server') ?? undefined,
			cfMitigated: response.headers.get('cf-mitigated') ?? undefined,
		});
		// Drain the body so the connection can be released.
		await response.text().catch(() => undefined);
		return { status: 'ok', isWebApp: false };
	}

	// 2xx but not HTML (JSON API, file, redirect to a binary, …): nothing to
	// analyse for the web-app gate, but the host responded — let it proceed.
	const contentType = response.headers.get('content-type') ?? '';
	if (!contentType.includes('text/html') && !contentType.includes('xhtml')) {
		await response.text().catch(() => undefined);
		return { status: 'ok', isWebApp: false };
	}

	let html: string;
	try {
		html = await response.text();
	} catch {
		return { status: 'ok', isWebApp: false };
	}

	if (!html) return { status: 'ok', isWebApp: false };

	const $ = cheerio.load(html);
	const gate = detectWebAppGate(html, url, $);

	return { status: 'ok', isWebApp: gate.authForm || gate.appShell };
}
