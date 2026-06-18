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
	| { status: 'ok'; isWebApp: boolean };

export async function validateScanTarget(
	url: string,
): Promise<ScanTargetValidation> {
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
