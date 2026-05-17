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
