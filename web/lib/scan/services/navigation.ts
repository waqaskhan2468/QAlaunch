import type { BrowserContext, Page, Response } from 'playwright-core';
import type { ScanResult, ScanStep } from '../types/scan.types';
import { buildResponseSecurityMeta } from './responseMeta';

// ─── Timing constants ──────────────────────────────────────────────────────
//
// These apply to every safeGoto call — desktop AND mobile context.
// With our parallel mobile-navigation optimisation, mobile context navigation
// runs concurrently with desktop data collection, so every ms saved here
// directly shrinks total scan wall-clock time.
//
// 20 s default — override with SCAN_NAV_TIMEOUT_MS. Enough for Browserbase remote CDP.
const DEFAULT_NAV_TIMEOUT_MS = 20_000;
const NETWORK_IDLE_TIMEOUT = 3_000;  // short networkidle check post-nav; non-fatal on timeout
const CONTENT_READY_TIMEOUT = 5_000; // DOM content check; non-fatal on timeout
const SPA_HYDRATION_TIMEOUT = 6_000; // wait for #root/#app/#__next to gain children
const CHALLENGE_CLEAR_TIMEOUT = 25_000; // max time to wait for a CDN challenge to resolve
const EXTRA_WAIT_MS = 500;           // brief post-nav settle wait (browser-side evaluate)

const MIN_BODY_TEXT_LENGTH = 500;
const MIN_LINK_COUNT = 5;

export function getNavTimeoutMs(): number {
	const raw = Number.parseInt(process.env.SCAN_NAV_TIMEOUT_MS ?? '', 10);
	return Number.isFinite(raw) && raw >= 10_000 ? raw : DEFAULT_NAV_TIMEOUT_MS;
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

async function waitForMeaningfulContent(
	page: Page,
): Promise<string | undefined> {
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

				return (
					bodyText.length >= minBodyTextLength ||
					linkCount >= minLinkCount ||
					headingCount > 0
				);
			},
			{
				minBodyTextLength: MIN_BODY_TEXT_LENGTH,
				minLinkCount: MIN_LINK_COUNT,
			},
			{
				timeout: CONTENT_READY_TIMEOUT,
			},
		);

		return undefined;
	} catch (error) {
		return `content readiness skipped after ${CONTENT_READY_TIMEOUT}ms: ${cleanError(error)}`;
	}
}

/**
 * Wait for a SPA shell (#root / #app / #__next / [data-reactroot]) to gain
 * its first children. Without this, `domcontentloaded` returns against an
 * empty `<div id="root">` and every downstream collector (axe, links, seo, …)
 * runs against a half-rendered page.
 *
 * If none of the SPA root selectors exist, this resolves immediately — the
 * page is probably server-rendered and doesn't need hydration.
 *
 * Non-fatal: surfaces a warning string on timeout, never throws.
 */
async function waitForSpaHydration(
	page: Page,
): Promise<string | undefined> {
	try {
		await page.waitForFunction(
			() => {
				const SPA_ROOT_SELECTORS = [
					'#root',
					'#app',
					'#__next',
					'[data-reactroot]',
				];

				const rootsPresent = SPA_ROOT_SELECTORS.map((selector) =>
					document.querySelector(selector),
				);

				const hasAnyRoot = rootsPresent.some((node) => node !== null);
				if (!hasAnyRoot) return true;

				return rootsPresent.some(
					(node) => node !== null && node.children.length > 0,
				);
			},
			undefined,
			{ timeout: SPA_HYDRATION_TIMEOUT },
		);

		return undefined;
	} catch (error) {
		return `spa hydration skipped after ${SPA_HYDRATION_TIMEOUT}ms: ${cleanError(error)}`;
	}
}

// ─── CDN challenge detection ───────────────────────────────────────────────

type ChallengeKind =
	| 'cloudflare_title'
	| 'cloudflare_turnstile'
	| 'cloudflare_challenge_platform';

async function detectCdnChallenge(page: Page): Promise<ChallengeKind | null> {
	try {
		return await page.evaluate(() => {
			const title = document.title || '';
			if (/Just a moment|Checking your browser|Attention Required/i.test(title)) {
				return 'cloudflare_title' as const;
			}
			if (document.querySelector('iframe[src*="challenges.cloudflare.com"]')) {
				return 'cloudflare_turnstile' as const;
			}
			if (
				document.querySelector(
					'script[src*="/cdn-cgi/challenge-platform/"]',
				)
			) {
				return 'cloudflare_challenge_platform' as const;
			}
			return null;
		});
	} catch {
		return null;
	}
}

/**
 * If a CDN challenge is detected post-navigation, wait for it to clear using
 * waitForFunction (client-side polling — keeps CDP alive, avoids goIntervalTiming drops).
 *
 * @throws Error with message starting with `cloudflare_challenge`
 */
async function handlePotentialChallenge(
	page: Page,
): Promise<string | undefined> {
	const initial = await detectCdnChallenge(page);
	if (!initial) return undefined;

	try {
		await page.waitForFunction(
			() => {
				const title = document.title || '';
				if (
					/Just a moment|Checking your browser|Attention Required/i.test(title)
				)
					return false;
				if (
					document.querySelector('iframe[src*="challenges.cloudflare.com"]')
				)
					return false;
				if (
					document.querySelector(
						'script[src*="/cdn-cgi/challenge-platform/"]',
					)
				)
					return false;
				return true;
			},
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
): Promise<{ navigation: NavigationResult; response: Response | null }> {
	let response: Response | null = null;
	let commitFallbackUsed: string | undefined;

	try {
		response = await page.goto(url, {
			waitUntil: 'domcontentloaded',
			timeout: getNavTimeoutMs(),
		});
	} catch (domContentLoadedError) {
		response = await page.goto(url, {
			waitUntil: 'commit',
			timeout: getNavTimeoutMs(),
		});
		commitFallbackUsed = `domcontentloaded timed out, commit fallback used: ${cleanError(domContentLoadedError)}`;
	}

	const challengeWarning = await handlePotentialChallenge(page);

	const [networkIdleWarning, contentWarning, spaWarning] = await Promise.all([
		waitForShortNetworkIdle(page),
		waitForMeaningfulContent(page),
		waitForSpaHydration(page),
	]);

	const warnings = [
		commitFallbackUsed,
		challengeWarning,
		networkIdleWarning,
		contentWarning,
		spaWarning,
	].filter(Boolean) as string[];

	await page.evaluate(
		(ms: number) => new Promise((r) => setTimeout(r, ms)),
		EXTRA_WAIT_MS,
	);

	const baseStrategy = commitFallbackUsed ? 'commit' : 'domcontentloaded';
	const strategy = warnings.length ? baseStrategy : `${baseStrategy}+ready`;

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
