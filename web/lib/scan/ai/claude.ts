import {
	claudeIssuesResponseSchema,
	legacyClaudeIssuesResponseSchema,
	type ClaudeIssue,
} from './types';

const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-6';
const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_MAX_TOKENS = 8_000;
const MAX_RESPONSE_PREVIEW_LENGTH = 500;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

/** Anthropic tool name — must match `tool_choice` and tool definition. */
export const REPORT_SCAN_ISSUES_TOOL_NAME = 'report_scan_issues';

/**
 * User-message prefix marked with `cache_control` (must not contain signed URLs).
 * Placed before screenshot URLs so the cacheable prefix is stable across pages in a scan.
 */
export const CLAUDE_SCAN_CACHEABLE_USER_TEXT = [
	'Analyze this webpage and identify all quality issues.',
	'',
	'SCREENSHOTS — READ THESE FIRST after the page context block below:',
	'Two images are attached in order (desktop, then mobile):',
	'  Image 1 — Desktop viewport: Walk the page top to bottom. Note hero, nav, CTAs, layout, whitespace, typography, trust signals, footer.',
	'  Image 2 — Mobile viewport: Check nav collapse, hero readability above fold, button sizes and spacing, text legibility, horizontal scroll, thumb-zone placement.',
	'Cross-reference what you see in the screenshots against the structured data after the images.',
	'Report viewport-specific issues under "responsiveness"; issues visible on both viewports under "ui_bugs" or "usability_ux".',
	'',
	'HEURISTICS INSTRUCTIONS:',
	'- Treat programmatic findings (brokenStates) as high-signal; confirm visually where relevant.',
	'- Do NOT duplicate an issue already fully explained in brokenStates unless the screenshot shows different or higher severity.',
	'- DO report purely visual issues that code cannot detect: wrong imagery, poor whitespace, typography feel, trust-signal gaps.',
	'',
].join('\n');

const SYSTEM_PROMPT = `You are a senior QA engineer with 10-12 years of professional experience manually testing websites for usability, UI bugs, functionality, responsiveness, performance, SEO, accessibility, security, and content quality. You have audited over 1,000 websites including eCommerce, SaaS, business sites, and Shopify stores.

Your job is to analyze the data AND screenshots provided about a webpage and identify ACTIONABLE issues that affect real users, not generic suggestions.

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

VISUAL REVIEW CHECKLIST (apply to both screenshots methodically):
- Hero / above fold: Is the value proposition clear within 5 seconds? Is the headline readable and prominent on both viewports?
- Navigation: Is the nav visible, accessible, and usable on mobile? Are active/hover states clear?
- Primary CTA: Is there one obvious primary action? Is it above the fold? Does the button have sufficient contrast and size?
- Typography: Consistent font sizes? Body text comfortably readable (feels at least 15–16px)? Line length not too wide or narrow?
- Spacing & layout: Are sections visually separated? Is whitespace balanced, or does anything feel cramped or crowded?
- Trust signals: Testimonials, client logos, security badges, social proof — are they present and visually intact?
- Images & media: Are images sharp and correctly sized? Any broken image placeholders? Aspect ratios preserved on mobile?
- Mobile thumb zone: Are interactive elements (buttons, links, nav items) reachable with one thumb? Not clustered at top corners or edges?
- Footer: Are contact info, legal links, and social links present and not broken?
- Colour & contrast: Do text and interactive elements have sufficient contrast against their backgrounds?
- Consistency: Are fonts, colours, and button styles consistent across the page, or do sections look mismatched?

PRIORITY ORDER (report findings in this order of importance):
1. Broken functionality — console errors affecting visible UI, failed requests blocking content, forms that cannot submit
2. Critical accessibility — axe serious/critical violations that affect real users
3. Mobile layout breaks — content cut off, unreadable text, horizontal scroll, buttons unreachable
4. Desktop layout bugs — misaligned sections, overlapping elements, broken images
5. UX clarity — unclear CTAs, poor visual hierarchy, confusing flow
6. SEO issues — missing/duplicate title, poor meta, missing alt text
7. Content & trust — placeholder text, inconsistent copy, missing trust signals

ACCESSIBILITY GUIDANCE:
- Prioritise axe violations by impact: critical > serious > moderate > minor
- For serious/critical violations, confirm visually whether the issue affects visible UI
- Do NOT re-report an axe violation verbatim; only include it if you can add visual context or a clearer fix instruction than axe provides

FIELD LENGTHS (required for database storage; responses outside these bounds are rejected):
- title: 20-80 characters (after trimming whitespace)
- description: 100-800 characters
- impact: 20-200 characters
- fix_instructions: at least 20 characters (be actionable)

OUTPUT: You MUST call the tool "${REPORT_SCAN_ISSUES_TOOL_NAME}" exactly once with every issue in the "issues" array. Do not return issues as plain JSON in assistant text.

EVIDENCE (required per issue — pick the best primary source):
- visual: primarily from screenshots (layout, spacing, hierarchy, imagery).
- axe: grounded in axe violation data (still add human context in description when possible).
- console: grounded in browser console messages.
- network: grounded in failed requests / HTTP errors.
- heuristic: grounded in programmatic brokenStates / rollup.
- programmatic: same as heuristic (rollup-only or automated signal without a finer bucket).
- mixed: multiple sources equally important.

CONFIDENCE: number from 0 to 1. Use values below 0.6 when you are guessing or the signal is weak.

BOUNDING_BOX (optional): only when evidence is visual or mixed AND you can place a tight box on the matching screenshot. Coordinates must be pixel space of the image we sent: target "desktop" for the first image, "mobile" for the second. Omit entirely when unsure — never invent a full-page box.

category must be one of: functionality, ui_bugs, usability_ux, responsiveness, performance, seo, accessibility, security, content.
severity must be one of: critical, high, medium, low.`;

/**
 * JSON Schema for Anthropic tool use (draft subset).
 * @see https://docs.anthropic.com/en/docs/build-with-claude/tool-use
 */
const REPORT_SCAN_ISSUES_INPUT_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	properties: {
		issues: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				properties: {
					category: {
						type: 'string',
						enum: [
							'functionality',
							'ui_bugs',
							'usability_ux',
							'responsiveness',
							'performance',
							'seo',
							'accessibility',
							'security',
							'content',
						],
					},
					severity: {
						type: 'string',
						enum: ['critical', 'high', 'medium', 'low'],
					},
				title: { type: 'string', minLength: 20, maxLength: 80 },
				description: { type: 'string', minLength: 100, maxLength: 800 },
				impact: { type: 'string', minLength: 20, maxLength: 200 },
				page_section: { type: 'string', maxLength: 500 },
				fix_instructions: { type: 'string', minLength: 20, maxLength: 8000 },
					evidence: {
						type: 'string',
						enum: [
							'visual',
							'axe',
							'console',
							'network',
							'heuristic',
							'programmatic',
							'mixed',
						],
					},
					confidence: { type: 'number', minimum: 0, maximum: 1 },
					bounding_box: {
						type: 'object',
						additionalProperties: false,
						properties: {
							target: { type: 'string', enum: ['desktop', 'mobile'] },
							x: { type: 'number' },
							y: { type: 'number' },
							width: { type: 'number', minimum: 1 },
							height: { type: 'number', minimum: 1 },
						},
						required: ['target', 'x', 'y', 'width', 'height'],
					},
				},
				required: [
					'category',
					'severity',
					'title',
					'description',
					'impact',
					'fix_instructions',
					'evidence',
					'confidence',
				],
			},
		},
	},
	required: ['issues'],
} as const;

const REPORT_SCAN_ISSUES_TOOLS = [
	{
		name: REPORT_SCAN_ISSUES_TOOL_NAME,
		description:
			'Report all QA issues for this page in one structured payload. Call exactly once per request.',
		input_schema: REPORT_SCAN_ISSUES_INPUT_SCHEMA,
	},
];

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

type MessageContentBlock =
	| { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }
	| {
			type: 'image';
			source: { type: 'url'; url: string };
	  };

/**
 * @param input.cachedUserText — Stable per-scan instructions; marked with prompt cache (must not contain signed URLs).
 * @param input.dynamicBeforeImagesText — Page context shown before screenshots.
 * @param input.dynamicAfterImagesText — Large JSON payload after screenshots.
 */
export async function analyzeWithClaude(input: {
	desktopScreenshotUrl: string;
	mobileScreenshotUrl: string;
	cachedUserText: string;
	dynamicBeforeImagesText: string;
	dynamicAfterImagesText: string;
	scanId?: string;
	pageUrl?: string;
}) {
	const config = getClaudeConfig();

	const userContent: MessageContentBlock[] = [
		{
			type: 'text',
			text: input.cachedUserText,
			cache_control: { type: 'ephemeral' },
		},
		{ type: 'text', text: input.dynamicBeforeImagesText },
		{ type: 'text', text: 'Desktop screenshot:' },
		{
			type: 'image',
			source: {
				type: 'url',
				url: input.desktopScreenshotUrl,
			},
		},
		{ type: 'text', text: 'Mobile screenshot:' },
		{
			type: 'image',
			source: {
				type: 'url',
				url: input.mobileScreenshotUrl,
			},
		},
		{ type: 'text', text: input.dynamicAfterImagesText },
	];

	const maxTokens = DEFAULT_MAX_TOKENS;

	const body = JSON.stringify({
		model: config.model,
		max_tokens: maxTokens,
		system: [
			{
				type: 'text',
				text: SYSTEM_PROMPT,
				cache_control: { type: 'ephemeral' },
			},
		],
		tools: REPORT_SCAN_ISSUES_TOOLS,
		tool_choice: {
			type: 'tool',
			name: REPORT_SCAN_ISSUES_TOOL_NAME,
		},
		messages: [
			{
				role: 'user',
				content: userContent,
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

			const json = (await res.json()) as {
				stop_reason?: string;
				content?: Array<{
					type?: string;
					text?: string;
					name?: string;
					input?: unknown;
				}>;
			};

			if (json.stop_reason === 'max_tokens') {
				console.warn(JSON.stringify({
					ts: new Date().toISOString(),
					level: 'warn',
					event: 'claude:response_truncated',
					scanId: input.scanId,
					pageUrl: input.pageUrl,
					model: config.model,
					stop_reason: 'max_tokens',
					note: 'Increase max_tokens or reduce prompt size to avoid truncated tool output.',
				}));
			}

			console.log(JSON.stringify({
				ts: new Date().toISOString(),
				level: 'info',
				event: 'claude:request_completed',
				scanId: input.scanId,
				pageUrl: input.pageUrl,
				model: config.model,
				attempt,
				status: res.status,
				durationMs,
				stop_reason: json.stop_reason ?? null,
			}));

			return json;
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function parseIssuesFromToolUse(raw: unknown): unknown | null {
	const content = (raw as { content?: unknown })?.content;
	if (!Array.isArray(content)) return null;

	for (const block of content) {
		if (!isRecord(block)) continue;
		if (
			block.type === 'tool_use' &&
			block.name === REPORT_SCAN_ISSUES_TOOL_NAME &&
			block.input !== undefined
		) {
			return block.input;
		}
	}
	return null;
}

export function parseClaudeIssues(raw: unknown): ClaudeIssue[] {
	const fromTool = parseIssuesFromToolUse(raw);
	const payload = fromTool ?? (() => {
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
			throw new Error(
				'Claude response did not contain tool_use input or parseable JSON.',
			);
		}
		return parsedJson;
	})();

	const parsed = claudeIssuesResponseSchema.safeParse(payload);

	if (parsed.success) {
		return parsed.data.issues;
	}

	const legacy = legacyClaudeIssuesResponseSchema.safeParse(payload);
	if (legacy.success) {
		return legacy.data.issues.map(
			(row): ClaudeIssue => ({
				...row,
				evidence: 'mixed',
				confidence: 0.7,
			}),
		);
	}

	throw new Error(
		`Invalid Claude issues payload: ${parsed.error.message}`,
	);
}
