import { z } from 'zod';

/** Matches `public.issues.category` check constraint in Supabase. */
export const issueCategorySchema = z.enum([
	'functionality',
	'ui_bugs',
	'usability_ux',
	'responsiveness',
	'performance',
	'seo',
	'accessibility',
	'security',
	'content',
]);

/** Matches `public.issues.severity` check constraint in Supabase. */
export const issueSeveritySchema = z.enum([
	'critical',
	'high',
	'medium',
	'low',
]);

const trimmed = z.string().trim();

/** Where the finding is grounded (tool output + `scan_pages.ai_analysis`). */
export const issueEvidenceSchema = z.enum([
	'visual',
	'axe',
	'console',
	'network',
	'heuristic',
	'programmatic',
	'mixed',
]);

/** Pixel box on the screenshot sent to the model (Phase-5 annotation hook). */
export const claudeBoundingBoxSchema = z.object({
	target: z.enum(['desktop', 'mobile']),
	x: z.number(),
	y: z.number(),
	width: z.number().positive(),
	height: z.number().positive(),
});

/**
 * Single issue from Claude — lengths aligned with Postgres CHECKs on `public.issues`.
 * `evidence`, `confidence`, and optional `bounding_box` are stored on `scan_pages.ai_analysis` JSON;
 * `public.issues` rows keep the core columns only.
 */
export const claudeIssueSchema = z.object({
	category: issueCategorySchema,
	severity: issueSeveritySchema,
	title: trimmed.pipe(z.string().min(20).max(80)),
	description: trimmed.pipe(z.string().min(100).max(800)),
	impact: trimmed.pipe(z.string().min(20).max(200)),
	page_section: z
		.union([trimmed.pipe(z.string().min(1).max(500)), z.literal('')])
		.optional(),
	fix_instructions: trimmed.pipe(z.string().min(20).max(8000)),
	evidence: issueEvidenceSchema,
	confidence: z.number().min(0).max(1),
	bounding_box: claudeBoundingBoxSchema.optional(),
});

export const claudeIssuesResponseSchema = z.object({
	issues: z.array(claudeIssueSchema),
});

/** Legacy assistant-text JSON (before tool use + evidence fields). */
export const legacyClaudeIssueSchema = z.object({
	category: issueCategorySchema,
	severity: issueSeveritySchema,
	title: trimmed.pipe(z.string().min(20).max(80)),
	description: trimmed.pipe(z.string().min(100).max(800)),
	impact: trimmed.pipe(z.string().min(20).max(200)),
	page_section: z
		.union([trimmed.pipe(z.string().min(1).max(500)), z.literal('')])
		.optional(),
	fix_instructions: trimmed.pipe(z.string().min(20).max(8000)),
});

export const legacyClaudeIssuesResponseSchema = z.object({
	issues: z.array(legacyClaudeIssueSchema),
});

export type ClaudeIssue = z.infer<typeof claudeIssueSchema>;
export type IssueCategory = z.infer<typeof issueCategorySchema>;
export type IssueSeverity = z.infer<typeof issueSeveritySchema>;
export type IssueEvidence = z.infer<typeof issueEvidenceSchema>;
export type ClaudeBoundingBox = z.infer<typeof claudeBoundingBoxSchema>;

/** String limits aligned with `claudeIssueSchema` / Postgres `issues` checks. */
export const CLAUDE_ISSUE_STRING_LIMITS = {
	title: { min: 20, max: 80 },
	description: { min: 100, max: 800 },
	impact: { min: 20, max: 200 },
	page_section: { min: 1, max: 500 },
	fix_instructions: { min: 20, max: 8000 },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

/**
 * Trim and clamp a Claude string field so minor length violations do not fail the scan.
 */
export function clampClaudeString(
	value: unknown,
	min: number,
	max: number,
): string {
	let s = typeof value === 'string' ? value.trim() : '';
	if (s.length > max) {
		s = s.slice(0, max).trimEnd();
	}
	if (s.length < min) {
		const filler = ' See report for details.';
		s = (s + filler).slice(0, max);
		if (s.length < min) {
			s = s.padEnd(min, '.');
		}
	}
	return s;
}

function normalizeIssueRow(row: unknown): unknown {
	if (!isRecord(row)) return row;

	const pageSection = row.page_section;
	const normalizedPageSection =
		pageSection === '' || pageSection == null ?
			pageSection
		:	clampClaudeString(
				pageSection,
				CLAUDE_ISSUE_STRING_LIMITS.page_section.min,
				CLAUDE_ISSUE_STRING_LIMITS.page_section.max,
			);

	const confidence =
		typeof row.confidence === 'number' ?
			Math.min(1, Math.max(0, row.confidence))
		:	row.confidence;

	return {
		...row,
		title: clampClaudeString(
			row.title,
			CLAUDE_ISSUE_STRING_LIMITS.title.min,
			CLAUDE_ISSUE_STRING_LIMITS.title.max,
		),
		description: clampClaudeString(
			row.description,
			CLAUDE_ISSUE_STRING_LIMITS.description.min,
			CLAUDE_ISSUE_STRING_LIMITS.description.max,
		),
		impact: clampClaudeString(
			row.impact,
			CLAUDE_ISSUE_STRING_LIMITS.impact.min,
			CLAUDE_ISSUE_STRING_LIMITS.impact.max,
		),
		page_section: normalizedPageSection,
		fix_instructions: clampClaudeString(
			row.fix_instructions,
			CLAUDE_ISSUE_STRING_LIMITS.fix_instructions.min,
			CLAUDE_ISSUE_STRING_LIMITS.fix_instructions.max,
		),
		...(confidence !== undefined ? { confidence } : {}),
	};
}

/** Coerce tool output to schema limits before Zod validation. */
export function normalizeClaudeIssuesPayload(payload: unknown): unknown {
	if (!isRecord(payload) || !Array.isArray(payload.issues)) {
		return payload;
	}

	return {
		...payload,
		issues: payload.issues.map(normalizeIssueRow),
	};
}
