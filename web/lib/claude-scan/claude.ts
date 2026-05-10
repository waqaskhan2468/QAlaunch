import { claudeIssuesResponseSchema, type ClaudeIssue } from '@/types/claude';

const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-6';
const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_MAX_RETRIES = 2;
const MAX_RESPONSE_PREVIEW_LENGTH = 500;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

const SYSTEM_PROMPT = `You are a senior QA engineer with 10-12 years of professional experience manually testing websites for usability, UI bugs, functionality, responsiveness, performance, SEO, accessibility, security, and content quality. You have audited over 1,000 websites including eCommerce, SaaS, business sites, and Shopify stores.

Your job is to analyze the data provided about a webpage and identify ACTIONABLE issues that affect real users, not generic suggestions.

RULES:
1. Focus on issues that affect real human users first
2. Be specific; name the exact section or element where the issue appears
3. Every issue must have severity: critical, high, medium, or low
4. Every issue must have a real business impact statement
5. Provide developer-actionable fix instructions
6. Categorize issues correctly
7. Order findings by severity within each category
8. Be concise but specific
9. Reference exact pages and sections
10. Do NOT report generic improvements; only real, observable problems
11. Use this category mapping strictly:
    - responsiveness: viewport-specific layout breaks (overlap, clipping, horizontal scroll, content off-screen, broken wrapping, elements disappearing only on some screen sizes)
    - ui_bugs: visual defects not tied to viewport size (color, contrast, icon/image glitches, spacing inconsistencies visible across sizes)
    - usability_ux: interaction/confusion issues (unclear CTAs, poor flow, discoverability), not raw layout breakage

FIELD LENGTHS (required for database storage; responses outside these bounds are rejected):
- title: 20-80 characters (after trimming whitespace)
- description: 100-800 characters
- impact: 20-200 characters
- fix_instructions: at least 20 characters (be actionable)

OUTPUT: Return ONLY valid JSON (no markdown fences) with this shape:
{"issues":[{"category":"...","severity":"...","title":"...","description":"...","impact":"...","page_section":"optional","fix_instructions":"..."}]}

category must be one of: functionality, ui_bugs, usability_ux, responsiveness, performance, seo, accessibility, security, content.
severity must be one of: critical, high, medium, low.`;

class ClaudeApiError extends Error {
	constructor(
		message: string,
		readonly retryable: boolean,
		readonly status?: number,
	) {
		super(message);
		this.name = 'ClaudeApiError';
	}
}

function getPositiveIntEnv(name: string, fallback: number): number {
	const value = Number.parseInt(process.env[name] ?? '', 10);
	return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getClaudeConfig() {
	return {
		model: process.env.ANTHROPIC_MODEL ?? DEFAULT_CLAUDE_MODEL,
		timeoutMs: getPositiveIntEnv('ANTHROPIC_TIMEOUT_MS', DEFAULT_TIMEOUT_MS),
		maxRetries: getPositiveIntEnv('ANTHROPIC_MAX_RETRIES', DEFAULT_MAX_RETRIES),
	};
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBackoffMs(attempt: number): number {
	return Math.min(1000 * 2 ** (attempt - 1), 8000);
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ?
			error.message
		:	'Unknown Claude request error.';
}

function isAbortError(error: unknown): boolean {
	return error instanceof Error && error.name === 'AbortError';
}

function isRetryableClaudeError(error: unknown): boolean {
	if (error instanceof ClaudeApiError) return error.retryable;
	return isAbortError(error);
}

export async function analyzeWithClaude(input: {
	desktopScreenshotUrl: string;
	mobileScreenshotUrls?: string[];
	// Backward-compatible fields (older callers / stale TS server state).
	mobileScreenshotUrl?: string;
	responsiveScreenshotUrls?: string[];
	prompt: string;
	scanId?: string;
	pageUrl?: string;
}) {
	const config = getClaudeConfig();

	const mergedMobileUrls = Array.from(
		new Set([
			...(input.mobileScreenshotUrls ?? []),
			...(input.mobileScreenshotUrl ? [input.mobileScreenshotUrl] : []),
			...(input.responsiveScreenshotUrls ?? []),
		]),
	);

	const mobileImageBlocks = mergedMobileUrls.flatMap(
		(url, index) => [
			{
				type: 'text' as const,
				text: `Mobile slice ${index + 1}:`,
			},
			{
				type: 'image' as const,
				source: {
					type: 'url' as const,
					url,
				},
			},
		],
	);

	const body = JSON.stringify({
		model: config.model,
		max_tokens: 8000,
		system: [
			{
				type: 'text',
				text: SYSTEM_PROMPT,
				cache_control: { type: 'ephemeral' },
			},
		],
		messages: [
			{
				role: 'user',
				content: [
					{ type: 'text', text: 'Desktop screenshot:' },
					{
						type: 'image',
						source: {
							type: 'url',
							url: input.desktopScreenshotUrl,
						},
					},
					...mobileImageBlocks,
					{ type: 'text', text: input.prompt },
				],
			},
		],
	});

	for (let attempt = 1; attempt <= config.maxRetries + 1; attempt += 1) {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);
		const startedAt = Date.now();

		try {
			const res = await fetch('https://api.anthropic.com/v1/messages', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': process.env.ANTHROPIC_API_KEY!,
					'anthropic-version': '2023-06-01',
					'anthropic-beta': 'prompt-caching-2024-07-31',
				},
				body,
				signal: controller.signal,
			});

			const durationMs = Date.now() - startedAt;

			if (!res.ok) {
				const responseText = await res.text().catch(() => '');
				const responsePreview = responseText.slice(
					0,
					MAX_RESPONSE_PREVIEW_LENGTH,
				);
				const retryable = RETRYABLE_STATUS_CODES.has(res.status);

				console.warn('[claude] request failed', {
					scanId: input.scanId,
					pageUrl: input.pageUrl,
					model: config.model,
					attempt,
					status: res.status,
					durationMs,
					retryable,
					responsePreview,
				});

				throw new ClaudeApiError(
					`Claude API error: ${res.status}${responsePreview ? ` ${responsePreview}` : ''}`,
					retryable,
					res.status,
				);
			}

			console.log('[claude] request completed', {
				scanId: input.scanId,
				pageUrl: input.pageUrl,
				model: config.model,
				attempt,
				status: res.status,
				durationMs,
			});

			return res.json();
		} catch (error) {
			const durationMs = Date.now() - startedAt;
			const isLastAttempt = attempt > config.maxRetries;
			const retryable = isRetryableClaudeError(error);

			if (!retryable || isLastAttempt) {
				console.error('[claude] request exhausted', {
					scanId: input.scanId,
					pageUrl: input.pageUrl,
					model: config.model,
					attempt,
					durationMs,
					error: getErrorMessage(error),
				});
				throw error;
			}

			console.warn('[claude] retrying request', {
				scanId: input.scanId,
				pageUrl: input.pageUrl,
				model: config.model,
				attempt,
				durationMs,
				error: getErrorMessage(error),
			});

			await sleep(getBackoffMs(attempt));
		} finally {
			clearTimeout(timeoutId);
		}
	}

	throw new Error('Unexpected Claude retry loop exit.');
}

function extractJsonPayload(text: string): string {
	const trimmed = text.trim();
	const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/im);
	if (fenced?.[1]) return fenced[1].trim();
	const match = trimmed.match(/\{[\s\S]*\}/);
	return match?.[0] ?? trimmed;
}

export function parseClaudeIssues(raw: unknown): ClaudeIssue[] {
	const content = (raw as { content?: Array<{ type?: string; text?: string }> })
		?.content;
	const text =
		content
			?.map((item) => (item.type === 'text' ? (item.text ?? '') : ''))
			.join('') ?? '';

	let parsedJson: unknown;

	try {
		parsedJson = JSON.parse(extractJsonPayload(text));
	} catch {
		throw new Error('Claude response did not contain parseable JSON.');
	}

	const parsed = claudeIssuesResponseSchema.safeParse(parsedJson);

	if (!parsed.success) {
		throw new Error(`Invalid Claude JSON: ${parsed.error.message}`);
	}

	return parsed.data.issues;
}
