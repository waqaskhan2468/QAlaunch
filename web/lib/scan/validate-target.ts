import * as cheerio from 'cheerio';

import { fetchHomepageHtml } from '@/lib/api/fetchHomePageHtml';
import { detectWebAppGate } from '@/lib/utils/detect';

/**
 * Pre-scan validation gate. Runs server-side after a URL is submitted but
 * before any scan is queued (free or paid). It performs a short, single-attempt
 * homepage fetch and reuses the existing strict web-app detection so the
 * caller can:
 *   - reject unreachable / non-HTML targets, and
 *   - flag homepages that are a login/sign-up form or an authenticated app
 *     shell (so only public-facing pages are ever scanned).
 *
 * It does NOT touch the Inngest pipeline — `detectAndSelectPages` still runs
 * its own fetch + detection inside the job. This is a fast front-door check.
 */

// Short ceiling: this blocks a synchronous submit, so we fail fast rather than
// using the long (25s × 2) crawl-time budget.
const GATE_TIMEOUT_MS = 10_000;

export type ScanTargetValidation =
	| { status: 'unreachable' }
	| { status: 'ok'; isWebApp: boolean };

export async function validateScanTarget(
	url: string,
): Promise<ScanTargetValidation> {
	let html: string | null = null;

	try {
		html = await fetchHomepageHtml(url, {
			timeoutMs: GATE_TIMEOUT_MS,
			attempts: 1,
		});
	} catch {
		// Network error, timeout, HTTP error, or non-HTML content-type.
		return { status: 'unreachable' };
	}

	if (!html) return { status: 'unreachable' };

	const $ = cheerio.load(html);
	const gate = detectWebAppGate(html, url, $);

	return { status: 'ok', isWebApp: gate.authForm || gate.appShell };
}
