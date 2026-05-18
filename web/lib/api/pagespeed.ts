import type { PageSpeedStrategy, PageSpeedScores, PageSpeedResult, PsiResponse } from '@/lib/api/pagespeed.types';

const PSI_ENDPOINT =
	'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const DEFAULT_TIMEOUT_MS = 90_000;
const MAX_RETRIES = 1;

function validateHttpUrl(value: string): void {
	let parsed: URL;
	try {
		parsed = new URL(value);
	} catch {
		throw new Error('Invalid URL');
	}

	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		throw new Error('Invalid URL protocol');
	}
}

function scoreToPercent(value: unknown): number | null {
	return typeof value === 'number' ? Math.round(value * 100) : null;
}

function getAuditNumber(data: PsiResponse, key: string): number | null {
	const value = data?.lighthouseResult?.audits?.[key]?.numericValue;
	return typeof value === 'number' ? value : null;
}

function buildPsiUrl(targetUrl: string, strategy: PageSpeedStrategy): string {
	const url = new URL(PSI_ENDPOINT);
	url.searchParams.set('url', targetUrl);
	url.searchParams.set('strategy', strategy);

	url.searchParams.append('category', 'performance');
	url.searchParams.append('category', 'seo');
	url.searchParams.append('category', 'accessibility');
	url.searchParams.append('category', 'best-practices');

	const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;
	if (apiKey) url.searchParams.set('key', apiKey);

	return url.toString();
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : 'Unknown error';
}

function isRetriableError(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	if (error.name === 'AbortError') return true;
	return /PageSpeed request failed: (429|5\d\d)\b/.test(error.message);
}

async function sleep(ms: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithTimeout<T>(
	url: string,
	timeoutMs: number,
): Promise<T> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const res = await fetch(url, { signal: controller.signal });

		if (!res.ok) {
			const body = await res.text().catch(() => '');
			throw new Error(
				`PageSpeed request failed: ${res.status}${body ? ` body=${body.slice(0, 300)}` : ''}`,
			);
		}

		return (await res.json()) as T;
	} finally {
		clearTimeout(timeoutId);
	}
}

function extractScores(data: PsiResponse): PageSpeedScores {
	const categories = data?.lighthouseResult?.categories;

	return {
		performance: scoreToPercent(categories?.performance?.score),
		seo: scoreToPercent(categories?.seo?.score),
		accessibility: scoreToPercent(categories?.accessibility?.score),
		bestPractices: scoreToPercent(categories?.['best-practices']?.score),
		lcpMs: getAuditNumber(data, 'largest-contentful-paint'),
		fcpMs: getAuditNumber(data, 'first-contentful-paint'),
		cls: getAuditNumber(data, 'cumulative-layout-shift'),
		ttiMs: getAuditNumber(data, 'interactive'),
	};
}

async function runStrategy(
	targetUrl: string,
	strategy: PageSpeedStrategy,
	timeoutMs: number,
): Promise<PageSpeedScores> {
	let attempt = 0;

	while (attempt <= MAX_RETRIES) {
		try {
			const url = buildPsiUrl(targetUrl, strategy);
			const data = await fetchJsonWithTimeout<PsiResponse>(url, timeoutMs);
			return extractScores(data);
		} catch (error) {
			if (!isRetriableError(error) || attempt === MAX_RETRIES) {
				throw error;
			}
			attempt += 1;
			await sleep(1200 * attempt);
		}
	}

	throw new Error('Unexpected PageSpeed retry loop exit');
}

const DEFAULT_STRATEGIES: PageSpeedStrategy[] = ['mobile', 'desktop'];

export async function runPageSpeedForUrl(
	targetUrl: string,
	options?: {
		timeoutMs?: number;
		strategies?: PageSpeedStrategy[];
	},
): Promise<PageSpeedResult> {
	const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const strategies = options?.strategies ?? DEFAULT_STRATEGIES;

	try {
		validateHttpUrl(targetUrl);

		const settled = await Promise.allSettled(
			strategies.map((strategy) =>
				runStrategy(targetUrl, strategy, timeoutMs),
			),
		);

		const scoresByStrategy = new Map<PageSpeedStrategy, PageSpeedScores>();
		const strategyErrors: Partial<Record<PageSpeedStrategy, string>> = {};

		for (let i = 0; i < strategies.length; i += 1) {
			const strategy = strategies[i]!;
			const result = settled[i]!;
			if (result.status === 'fulfilled') {
				scoresByStrategy.set(strategy, result.value);
			} else {
				strategyErrors[strategy] = getErrorMessage(result.reason);
			}
		}

		const mobile = scoresByStrategy.get('mobile') ?? null;
		const desktop = scoresByStrategy.get('desktop') ?? null;

		const hasSuccess = Boolean(mobile || desktop);

		if (hasSuccess) {
			return {
				mobile,
				desktop,
				...(Object.keys(strategyErrors).length ? { strategyErrors } : {}),
			};
		}

		return {
			mobile: null,
			desktop: null,
			strategyErrors,
			error:
				strategies.length === 1 ?
					`${strategies[0]} PageSpeed run failed`
				:	'All PageSpeed runs failed',
		};
	} catch (error) {
		return {
			mobile: null,
			desktop: null,
			error: getErrorMessage(error),
		};
	}
}
