import type { BrowserContext, Page, Response } from 'playwright-core';
import type { ScanResult, ScanStep } from '../types/scan.types';
import { buildResponseSecurityMeta } from './responseMeta';

// 15 s default — override with SCAN_NAV_TIMEOUT_MS. Enough for Browserbase remote CDP.
const DEFAULT_NAV_TIMEOUT_MS = 15_000;
const NETWORK_IDLE_TIMEOUT = 1_000;
// Single timeout for the merged content + SPA hydration check.
const PAGE_READY_TIMEOUT_MS = 3_000;
const CHALLENGE_CLEAR_TIMEOUT = 10_000;

const MIN_BODY_TEXT_LENGTH = 500;
const MIN_LINK_COUNT = 5;

// Read once at module load — avoids re-parsing the env var on every safeGoto call.
const NAV_TIMEOUT_MS = (() => {
	const raw = Number.parseInt(process.env.SCAN_NAV_TIMEOUT_MS ?? '', 10);
	return Number.isFinite(raw) && raw >= 10_000 ? raw : DEFAULT_NAV_TIMEOUT_MS;
})();

export function getNavTimeoutMs(): number {
	return NAV_TIMEOUT_MS;
}

/**
 * Sentinel error message thrown when a CDN bot challenge (Cloudflare, etc.)
 * is detected and didn't clear within CHALLENGE_CLEAR_TIMEOUT.
 * Surfaced verbatim so scanBrowserOnlyStep can route it to fail-scan.ts as
 * non-retriable.
 */
export const CLOUDFLARE_CHALLENGE_ERROR = 'cloudflare_challenge';

type NavigationResult = {
	strategy: string;
	warning?: string;
};

// ─── Utilities ─────────────────────────────────────────────────────────────

export function cleanError(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	return message.replace(/\[[0-9;]*m/g, '').trim();
}

export function addStep(
	steps: ScanStep[],
	name: string,
	ok: boolean,
	error?: string,
): void {
	steps.push({ name, ok, ...(error ? { error } : {}) });
}

export async function runStep<T>(
	steps: ScanStep[],
	name: string,
	task: () => Promise<T>,
): Promise<T | undefined> {
	try {
		const result = await task();
		addStep(steps, name, true);
		return result;
	} catch (error) {
		addStep(steps, name, false, cleanError(error));
		return undefined;
	}
}

export async function closeContext(
	context: BrowserContext | null,
): Promise<void> {
	if (!context) return;

	try {
		await context.close();
	} catch {
		// Ignore browser cleanup errors.
	}
}

// ─── Navigation helpers ────────────────────────────────────────────────────

async function waitForShortNetworkIdle(
	page: Page,
): Promise<string | undefined> {
	try {
		await page.waitForLoadState('networkidle', {
			timeout: NETWORK_IDLE_TIMEOUT,
		});

		return undefined;
	} catch (error) {
		return `networkidle skipped after ${NETWORK_IDLE_TIMEOUT}ms: ${cleanError(error)}`;
	}
}

/**
 * Single waitForFunction combining meaningful-content + SPA-hydration checks.
 * One polling loop instead of two halves the CDP round-trips during navigation.
 *
 * Resolves immediately on SSR sites (PHP, WordPress, static HTML) — no SPA root,
 * content is server-rendered. Waits for root hydration on Vite / Next.js / React / Vue.
 */
async function waitForPageReady(page: Page): Promise<string | undefined> {
	try {
		await page.waitForFunction(
			({
				minBodyTextLength,
				minLinkCount,
			}: {
				minBodyTextLength: number;
				minLinkCount: number;
			}) => {
				const bodyText = document.body?.innerText?.trim() ?? '';
				const linkCount = document.querySelectorAll('a[href]').length;
				const headingCount = document.querySelectorAll('h1, h2').length;
				const hasContent =
					bodyText.length >= minBodyTextLength ||
					linkCount >= minLinkCount ||
					headingCount > 0;
				if (!hasContent) return false;

				// SSR (PHP, WordPress, static) — no SPA root, pass immediately.
				// SPAs (Next.js, Vite, React, Vue) must have root children before collectors run.
				const roots = ['#root', '#app', '#__next', '[data-reactroot]'].map(
					(s) => document.querySelector(s),
				);
				const hasRoot = roots.some(Boolean);
				if (!hasRoot) return true;
				return roots.some((n) => n !== null && n.children.length > 0);
			},
			{ minBodyTextLength: MIN_BODY_TEXT_LENGTH, minLinkCount: MIN_LINK_COUNT },
			{ timeout: PAGE_READY_TIMEOUT_MS },
		);

		return undefined;
	} catch (error) {
		return `page_ready skipped after ${PAGE_READY_TIMEOUT_MS}ms: ${cleanError(error)}`;
	}
}

// ─── CDN challenge detection ───────────────────────────────────────────────

type ChallengeKind =
	| 'cloudflare_title'
	| 'cloudflare_turnstile'
	| 'cloudflare_challenge_platform';

// Single source of truth — used by both detectCdnChallenge and handlePotentialChallenge.
const CF_TITLE_PATTERN = 'Just a moment|Checking your browser|Attention Required';
const CF_TURNSTILE_SEL = 'iframe[src*="challenges.cloudflare.com"]';
const CF_PLATFORM_SEL = 'script[src*="/cdn-cgi/challenge-platform/"]';

async function detectCdnChallenge(page: Page): Promise<ChallengeKind | null> {
	try {
		return await page.evaluate(
			({ titlePattern, turnstileSel, platformSel }: {
				titlePattern: string;
				turnstileSel: string;
				platformSel: string;
			}) => {
				const title = document.title || '';
				if (new RegExp(titlePattern, 'i').test(title)) return 'cloudflare_title' as const;
				if (document.querySelector(turnstileSel)) return 'cloudflare_turnstile' as const;
				if (document.querySelector(platformSel)) return 'cloudflare_challenge_platform' as const;
				return null;
			},
			{ titlePattern: CF_TITLE_PATTERN, turnstileSel: CF_TURNSTILE_SEL, platformSel: CF_PLATFORM_SEL },
		);
	} catch {
		return null;
	}
}

// If a CDN challenge is detected, polls until it clears or times out.
// Throws with CLOUDFLARE_CHALLENGE_ERROR prefix so the step can be marked non-retriable.
async function handlePotentialChallenge(
	page: Page,
): Promise<string | undefined> {
	const initial = await detectCdnChallenge(page);
	if (!initial) return undefined;

	try {
		await page.waitForFunction(
			({ titlePattern, turnstileSel, platformSel }: {
				titlePattern: string;
				turnstileSel: string;
				platformSel: string;
			}) => {
				const title = document.title || '';
				if (new RegExp(titlePattern, 'i').test(title)) return false;
				if (document.querySelector(turnstileSel)) return false;
				if (document.querySelector(platformSel)) return false;
				return true;
			},
			{ titlePattern: CF_TITLE_PATTERN, turnstileSel: CF_TURNSTILE_SEL, platformSel: CF_PLATFORM_SEL },
			{ timeout: CHALLENGE_CLEAR_TIMEOUT, polling: 1_000 },
		);
		return `${initial} cleared`;
	} catch {
		throw new Error(
			`${CLOUDFLARE_CHALLENGE_ERROR}: ${initial} did not clear within ${CHALLENGE_CLEAR_TIMEOUT}ms`,
		);
	}
}

// ─── Public API ────────────────────────────────────────────────────────────

export async function safeGoto(
	page: Page,
	url: string,
	options?: { timeout?: number },
): Promise<{ navigation: NavigationResult; response: Response | null }> {
	const navTimeout = options?.timeout ?? getNavTimeoutMs();

	// Always use 'commit' so goto resolves as soon as the server responds —
	// no second network round-trip if the page is slow to parse.
	// Then try waitForLoadState('domcontentloaded') as a non-fatal follow-up,
	// capped at 10 s — the page already committed so DOM should parse quickly.
	const response = await page.goto(url, { waitUntil: 'commit', timeout: navTimeout });

	let domWarning: string | undefined;
	try {
		await page.waitForLoadState('domcontentloaded', {
			timeout: Math.min(navTimeout, 10_000),
		});
	} catch (err) {
		domWarning = `domcontentloaded skipped: ${cleanError(err)}`;
	}

	const challengeWarning = await handlePotentialChallenge(page);

	const [networkIdleWarning, pageReadyWarning] = await Promise.all([
		waitForShortNetworkIdle(page),
		waitForPageReady(page),
	]);

	const warnings = [
		domWarning,
		challengeWarning,
		networkIdleWarning,
		pageReadyWarning,
	].filter(Boolean) as string[];

	const strategy = warnings.length ? 'commit' : 'commit+ready';

	return {
		navigation: {
			strategy,
			...(warnings.length ? { warning: warnings.join(' | ') } : {}),
		},
		response,
	};
}

export async function navigatePage(
	page: Page,
	url: string,
	result: ScanResult,
): Promise<void> {
	try {
		const { navigation, response } = await safeGoto(page, url);

		if (navigation.warning) {
			result.warnings.push(navigation.warning);
		}

		// Warn on HTTP error responses so AI analysis can caveat its findings.
		// We still run all collectors — the 4xx/5xx page content is worth analysing
		// (broken routes, server errors, or misconfigured redirects are real issues).
		const httpStatus = response?.status() ?? null;
		if (httpStatus !== null && httpStatus >= 400) {
			result.warnings.push(
				`http_error_response: server returned ${httpStatus} — page content may be an error page rather than the intended destination`,
			);
		}

		addStep(result.steps, `navigate:${navigation.strategy}`, true);
		result.responseSecurityMeta = buildResponseSecurityMeta(
			page,
			response,
			url,
		);
	} catch (error) {
		const message = cleanError(error);
		addStep(result.steps, 'navigate', false, message);
		throw new Error(`Navigation failed: ${message}`);
	}
}
