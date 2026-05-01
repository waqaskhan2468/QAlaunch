import { claudeIssuesResponseSchema, type ClaudeIssue } from '@/types/claude';

const SYSTEM_PROMPT = `You are a senior QA engineer with 10-12 years of professional experience manually testing websites for usability, UI bugs, functionality, responsiveness, security, and content quality.

RULES:
1. Focus on issues that affect real human users first
2. Be specific
3. Every issue must have severity
4. Every issue must have a real business impact statement
5. Provide developer-actionable fix instructions
6. Categorize issues correctly (including security and content where relevant)
7. Order findings by severity within each category
8. Be concise but specific
9. Reference exact pages and sections
10. Do NOT report generic improvements

FIELD LENGTHS (required for database storage; responses outside these bounds are rejected):
- title: 20–80 characters (after trimming whitespace)
- description: 100–800 characters
- impact: 20–200 characters
- fix_instructions: at least 20 characters (be actionable)

OUTPUT: Return ONLY valid JSON (no markdown fences) with this shape:
{"issues":[{"category":"...","severity":"...","title":"...","description":"...","impact":"...","page_section":"optional","fix_instructions":"..."}]}

category must be one of: functionality, ui_bugs, usability_ux, responsiveness, performance, seo, accessibility, security, content.
severity must be one of: critical, high, medium, low.`;

export async function analyzeWithClaude(input: {
	desktopScreenshotUrl: string;
	mobileScreenshotUrl: string;
	responsiveScreenshotUrls?: string[];
	prompt: string;
}) {
	const responsiveImageBlocks = (input.responsiveScreenshotUrls ?? []).flatMap(
		(url, index) => [
			{
				type: 'text' as const,
				text: `Responsive screenshot ${index + 1}:`,
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

	const res = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': process.env.ANTHROPIC_API_KEY!,
			'anthropic-version': '2023-06-01',
			'anthropic-beta': 'prompt-caching-2024-07-31',
		},
		body: JSON.stringify({
			model: 'claude-sonnet-4-5-20250929',
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
						{
							type: 'text',
							text: 'Desktop screenshot:',
						},
						{
							type: 'image',
							source: {
								type: 'url',
								url: input.desktopScreenshotUrl,
							},
						},
						{
							type: 'text',
							text: 'Mobile screenshot:',
						},
						{
							type: 'image',
							source: {
								type: 'url',
								url: input.mobileScreenshotUrl,
							},
						},
						...responsiveImageBlocks,
						{ type: 'text', text: input.prompt },
					],
				},
			],
		}),
	});

	if (!res.ok) {
		throw new Error(`Claude API error: ${res.status} ${await res.text()}`);
	}

	return res.json();
}

function extractJsonPayload(text: string): string {
	const trimmed = text.trim();
	const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/im);

	if (fenced?.[1]) {
		return fenced[1].trim();
	}

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
