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

/**
 * Single issue from Claude — lengths aligned with Postgres CHECKs on `public.issues`.
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
});

export const claudeIssuesResponseSchema = z.object({
	issues: z.array(claudeIssueSchema),
});

export type ClaudeIssue = z.infer<typeof claudeIssueSchema>;
export type IssueCategory = z.infer<typeof issueCategorySchema>;
export type IssueSeverity = z.infer<typeof issueSeveritySchema>;
