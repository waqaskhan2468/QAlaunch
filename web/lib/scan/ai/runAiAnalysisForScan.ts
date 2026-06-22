import { createConcurrencyLimit } from '@/lib/utils/concurrency-limit';
import {
	analyzeWithClaude,
	CLAUDE_SCAN_CACHEABLE_USER_TEXT,
	CLAUDE_SCAN_CACHEABLE_USER_TEXT_HYBRID_DESKTOP,
	CLAUDE_SCAN_CACHEABLE_USER_TEXT_HYBRID_MOBILE,
	CLAUDE_SCAN_CACHEABLE_USER_TEXT_NO_SCREENSHOTS,
	FREE_CLAUDE_TIMEOUT_MS,
	parseClaudeIssues,
} from './claude';
import {
	pageHasAnalyzableData,
	resolveAiAnalysisMode,
	type AiAnalysisMode,
} from './eligibility';
import {
	formatPageSpeedForClaude,
	PAGE_SPEED_CLAUDE_INSTRUCTIONS,
} from './format-page-speed-prompt';
import type { getServiceSupabase } from '@/lib/db/supabase';
import {
	formatErrorWithCause,
	updateScanPageAiAnalysis,
} from '@/lib/db/supabase-retry';
import { failScan, toUserFacingScanError } from '@/lib/scan/fail-scan';
import {
	CLAUDE_ISSUE_STRING_LIMITS,
	clampClaudeString,
	type ClaudeIssue,
	type IssueFindingType,
} from './types';
import type { ScanPackage } from '@/types/zod';

type ServiceSupabase = ReturnType<typeof getServiceSupabase>;

const CLAUDE_PROMPT_MAX_BROKEN_LINKS = 15;
const CLAUDE_PROMPT_MAX_EXTERNAL_LINKS = 15;

// Cap concurrent Claude calls per scan. Promise.all(all pages) fires N calls
// simultaneously — with 5 pages that is 5 parallel requests, the primary cause
// of 429 rate limits. 3 slots keeps scans fast while reducing API pressure.
const CLAUDE_CONCURRENCY = 3;

// ── Payload trimming constants ────────────────────────────────────────────
// Sending the full axe dump for heavy pages adds thousands of tokens with
// diminishing returns — most actionable issues are in critical/serious.
// We sort by severity, strip the verbose `nodes` array, and cap at 20 items.
const MAX_AXE_VIOLATIONS = 20;
const MAX_CONSOLE_MESSAGES = 30;

const SEVERITY_RANK: Record<string, number> = {
	critical: 0,
	high: 1,
	medium: 2,
	low: 3,
};

// axe-core impact levels (separate from our own severity scale)
const AXE_IMPACT_RANK: Record<string, number> = {
	critical: 0,
	serious: 1,
	moderate: 2,
	minor: 3,
};

const FREE_PREVIEW_ISSUE_COUNT = 3;

type ScanPageRow = {
	id: string;
	page_url: string;
	page_role: string | null;
	page_speed_data: unknown;
	playwright_data: unknown;
	axe_violations: unknown;
	screenshot_desktop_url: string | null;
	screenshot_mobile_url: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function getErrorMessage(error: unknown): string {
	return formatErrorWithCause(error);
}

/** Mobile screenshot URL for Claude analysis. */
function getPrimaryMobileScreenshotUrl(page: ScanPageRow): string | null {
	return (
			typeof page.screenshot_mobile_url === 'string' &&
				page.screenshot_mobile_url.length > 0
		) ?
			page.screenshot_mobile_url
		:	null;
}

function orderPages<T extends { id: string; page_url: string }>(
	pages: T[],
	pagesToTest: string[] | null | undefined,
): T[] {
	if (!pagesToTest?.length) {
		return [...pages];
	}

	const byUrl = new Map(pages.map((p) => [p.page_url, p]));
	const ordered: T[] = [];
	const seen = new Set<string>();

	for (const url of pagesToTest) {
		const p = byUrl.get(url);
		if (p) {
			ordered.push(p);
			seen.add(p.id);
		}
	}

	for (const p of pages) {
		if (!seen.has(p.id)) ordered.push(p);
	}

	return ordered;
}

function buildWebsiteTypeFocus(
	websiteType: string | null,
	pageRole: string | null,
): string {
	const lines: string[] = [];
	const type = (websiteType ?? '').toLowerCase();
	const role = (pageRole ?? '').toLowerCase();

	// ── Website-type context (exact enum match) ────────────────────────────
	switch (type) {
		case 'ecommerce':
			lines.push(
				'ECOMMERCE FOCUS: Pay close attention to — product images (quality, consistency), pricing display (clarity, formatting), add-to-cart / buy CTA (prominence, contrast), trust badges and reviews (present and visible), checkout path entry (obvious next step).',
			);
			break;
		case 'saas':
			lines.push(
				'SAAS FOCUS: Pay close attention to — value proposition clarity above fold, pricing section (readable, plans clear), feature comparison (scannable), trial/sign-up CTA (prominent), social proof (logos, testimonials visible).',
			);
			break;
		case 'agency':
			lines.push(
				'AGENCY FOCUS: Pay close attention to — work/case-study showcase (images load, layout intact), contact CTA (clear, above fold or sticky footer), client logo strip (crisp, consistent sizing), team credibility signals.',
			);
			break;
		case 'freelancer':
			lines.push(
				'FREELANCER FOCUS: Pay close attention to — "hire me" or contact CTA (above fold, prominent), portfolio samples (load correctly, variety shown), skills/services section (clear and scannable), testimonials or client logos (trust signals visible).',
			);
			break;
		case 'portfolio':
			lines.push(
				'PORTFOLIO FOCUS: Pay close attention to — project thumbnails (load, consistent aspect ratio), project descriptions (readable, not truncated), case-study depth (enough detail for credibility), contact route (obvious).',
			);
			break;
		case 'restaurant':
			lines.push(
				'RESTAURANT FOCUS: Pay close attention to — menu visibility and readability (easy to find and navigate), location and opening hours (prominent, correct format), reservation/order CTA (clear and functional), food photography (quality, correctly sized, appetising).',
			);
			break;
		case 'nonprofit':
			lines.push(
				'NONPROFIT FOCUS: Pay close attention to — donation CTA (prominent, above fold or sticky), mission statement clarity (clear within 5 seconds), impact statistics (visible and credible), volunteer/get-involved path (discoverable).',
			);
			break;
		case 'event':
			lines.push(
				'EVENT SITE FOCUS: Pay close attention to — event date, time, and location (immediately visible, unambiguous), registration/ticket CTA (prominent and functional), speaker or agenda section (scannable, properly formatted), countdown or urgency signals.',
			);
			break;
		case 'directory':
			lines.push(
				'DIRECTORY FOCUS: Pay close attention to — search bar visibility and responsiveness, listing cards (consistent format, readable), category/filter navigation (clear and usable), individual listing detail (sufficient information shown).',
			);
			break;
		case 'business':
			lines.push(
				'BUSINESS SITE FOCUS: Pay close attention to — service/product offering (clear above fold), contact information (phone, email, address visible), trust signals (years in business, certifications, testimonials), about section (humanises the business).',
			);
			break;
		case 'blog':
			lines.push(
				'BLOG FOCUS: Pay close attention to — article readability (font size, line-height, measure), navigation to related content, ad placement (does it obstruct content?), mobile reading experience.',
			);
			break;
		// 'webapp', 'landing', 'unknown' — no type-level checklist needed
	}

	// ── Page-role context ─────────────────────────────────────────────────
	switch (role) {
		case 'landing':
			lines.push(
				'LANDING PAGE: Single CTA priority — check that one action dominates. Verify headline, sub-headline, and CTA are all visible above the fold on desktop. On mobile, confirm CTA is reachable without scrolling far.',
			);
			break;
		case 'homepage':
		case 'home':
			lines.push(
				'HOMEPAGE: Check that each major section has a clear purpose and a visible next-step link. Verify no section is an orphan (no CTA, no link out).',
			);
			break;
		case 'pricing':
		case 'product':
			lines.push(
				'PRODUCT/PRICING PAGE: Verify that prices are readable and plans are visually distinguished. Check that the recommended / most popular plan is visually highlighted.',
			);
			break;
		case 'menu':
			lines.push(
				'MENU PAGE: Verify all sections are readable (font, contrast), prices are clear and aligned, dietary tags are visible, and mobile scroll is smooth without horizontal overflow.',
			);
			break;
		case 'donate':
			lines.push(
				'DONATE PAGE: Verify the donation CTA and amount selector are prominent, trust signals (charity registration, secure payment) are visible, and the form is accessible and functional.',
			);
			break;
		case 'work':
			lines.push(
				'WORK/PORTFOLIO PAGE: Verify project thumbnails load correctly and are consistently sized, descriptions are readable, and case-study links are functional.',
			);
			break;
		case 'team':
			lines.push(
				'TEAM PAGE: Verify headshots load and are consistently cropped, names and titles are readable at all viewports, and social/contact links are functional.',
			);
			break;
		case 'services':
			lines.push(
				'SERVICES PAGE: Verify each service has a clear description and its own CTA, pricing or scope indication is present, and the mobile layout is readable without horizontal scroll.',
			);
			break;
	}

	return lines.join('\n');
}

/**
 * Free-tier scope override. Placed right after the cached instructions (which tell
 * the model to "walk the page top to bottom" and check the footer) so it narrows a
 * free scan to the first impression — where conversion-critical issues concentrate.
 * The free screenshot is viewport-only, so the model already only SEES the top;
 * this stops it speculating about deep/footer content and cuts output tokens.
 */
const FREE_SCAN_FOCUS = [
	'SCOPE OVERRIDE — FREE TOP-OF-PAGE SCAN:',
	'This is a free scan focused on the FIRST IMPRESSION only. The screenshot is the top of the page (above the fold) — the hero and the very first section(s).',
	'- Analyze ONLY the hero/banner and the first one or two sections below the fold.',
	'- Ignore the cached instruction to walk the full page or inspect the footer. Do NOT report footer, deep-page, or below-the-fold content you cannot actually see.',
	'- Do NOT invent or infer issues about parts of the page outside the attached screenshot.',
	'- Prioritise hero clarity, the primary call-to-action, first-impression layout/contrast, and the first section(s).',
].join('\n');

/** Page-specific text placed before signed screenshot URLs (not prompt-cached). */
function buildAnalysisPromptBeforeImages(input: {
	pageUrl: string;
	pageRole: string | null;
	websiteType: string | null;
	isFree?: boolean;
}): string {
	const websiteTypeFocus = buildWebsiteTypeFocus(
		input.websiteType,
		input.pageRole,
	);

	return [
		...(input.isFree ? [FREE_SCAN_FOCUS, ''] : []),
		'CONTEXT:',
		`- Page URL: ${input.pageUrl}`,
		`- Page role: ${input.pageRole ?? 'unknown'}`,
		`- Website type: ${input.websiteType ?? 'unknown'}`,
		...(websiteTypeFocus ? ['', websiteTypeFocus] : []),
		'',
	].join('\n');
}

// ─── Axe violation trimming ────────────────────────────────────────────────

type AxeViolation = {
	id?: string;
	impact?: string;
	description?: string;
	help?: string;
	helpUrl?: string;
	tags?: string[];
	nodes?: unknown;
	[key: string]: unknown;
};

/**
 * Trim the axe violations array before sending to Claude.
 *
 * - Sort by impact severity (critical > serious > moderate > minor)
 * - Strip the verbose `nodes` array (each node can contain hundreds of chars
 *   of HTML; not useful to Claude since it can see the screenshots directly)
 * - Cap at MAX_AXE_VIOLATIONS items
 *
 * This reduces token count by 60–80 % on heavy pages while keeping all the
 * high-signal findings intact.
 */
function trimAxeViolations(raw: unknown, maxItems: number = MAX_AXE_VIOLATIONS): unknown {
	if (!Array.isArray(raw)) return raw;

	const sorted = [...(raw as AxeViolation[])].sort((a, b) => {
		const ra = AXE_IMPACT_RANK[a.impact ?? ''] ?? 99;
		const rb = AXE_IMPACT_RANK[b.impact ?? ''] ?? 99;
		return ra - rb;
	});

	return sorted
		.slice(0, maxItems)
		// Strip nodes (verbose HTML) and tags (WCAG category codes) — useless to Claude.
		.map(({ nodes: _nodes, tags: _tags, ...rest }) => rest);
}

/** Large JSON payload after screenshots (not prompt-cached). */
function buildAnalysisPromptAfterImages(input: {
	pageSpeedData: unknown;
	playwrightData: unknown;
	axeViolations: unknown;
	hasScreenshots: boolean;
	/** Free scans send a leaner payload (top-of-page focus) to cut tokens/latency. */
	isFree?: boolean;
}): string {
	// Free scans focus on the first impression, so cap the whole-page data lists
	// tighter — fewer tokens in and fewer issues out means a faster Claude call.
	const maxBrokenLinks = input.isFree ? 6 : CLAUDE_PROMPT_MAX_BROKEN_LINKS;
	const maxExternalLinks = input.isFree ? 6 : CLAUDE_PROMPT_MAX_EXTERNAL_LINKS;
	const maxConsole = input.isFree ? 8 : MAX_CONSOLE_MESSAGES;
	const maxAxe = input.isFree ? 8 : MAX_AXE_VIOLATIONS;
	const pd = input.playwrightData as Record<string, unknown> | null;
	const links = pd?.links as Record<string, unknown> | undefined;
	const brokenLinks = links?.brokenLinks;
	const allLinks = Array.isArray(links?.links) ? links.links : [];
	const brokenStates = pd?.brokenStates ?? null;
	const programmaticRollup = pd?.programmaticRollup ?? null;
	const responseSecurity = pd?.responseSecurity ?? null;
	const interactionTests = pd?.interactionTests ?? null;
	const interactionProbes = pd?.interactionProbes ?? null;
	const patternChecks = pd?.patternChecks as
		| { results?: Array<Record<string, unknown>> }
		| null
		| undefined;
	const verifiedPatternTitles = Array.isArray(patternChecks?.results)
		? patternChecks.results
				.filter((r) => r.status === 'fail' && typeof r.title === 'string')
				.map((r) => r.title as string)
		: [];

	const externalLinksSameTab = allLinks
		.filter((link) => {
			if (!isRecord(link)) return false;
			return link.isExternal === true && link.target !== '_blank';
		})
		.slice(0, maxExternalLinks);

	const brokenLinksForPrompt =
		Array.isArray(brokenLinks) ?
			(brokenLinks as unknown[]).slice(0, maxBrokenLinks)
		:	[];

	// Cap console messages to avoid prompt bloat from noisy pages
	const rawConsoleMessages = pd?.consoleMessages ?? [];
	const consoleMessages =
		Array.isArray(rawConsoleMessages) ?
			rawConsoleMessages.slice(0, maxConsole)
		:	rawConsoleMessages;

	// Trim axe violations: sort by severity, strip nodes, cap (tighter for free)
	const axeViolations = trimAxeViolations(input.axeViolations, maxAxe);

	const scanData = {
		consoleMessages,
		brokenLinks: brokenLinksForPrompt,
		externalLinksSameTab,
		forms:
			(pd?.interactive as Record<string, unknown> | undefined)?.forms ?? null,
		seoData: pd?.seoData ?? null,
		responsiveResults: pd?.responsive ?? null,
		httpErrors: pd?.httpErrors ?? [],
		failedRequests: pd?.failedRequests ?? [],
	};

	const dataHeader =
		input.hasScreenshots ?
			'STRUCTURED SCAN DATA (same page as screenshots above):'
		:	'STRUCTURED SCAN DATA (no screenshots — use PageSpeed and JSON only):';

	return [
		dataHeader,
		'',
		PAGE_SPEED_CLAUDE_INSTRUCTIONS,
		'',
		formatPageSpeedForClaude(input.pageSpeedData),
		'',
		'JAVASCRIPT CONSOLE ERRORS (context only — NOT proof of a user-facing bug):',
		'Report these as an issue ONLY when the screenshot or observed behaviour shows a matching visible symptom. If nothing visible is wrong, ignore them (or note once as a single low-severity technical note). Never infer a broken element from a console error alone.',
		JSON.stringify(scanData.consoleMessages, null, 2),
		'',
		'BROKEN / FAILED LINKS (already re-verified: 403s confirmed by real browser navigation, not bare fetch):',
		JSON.stringify(scanData.brokenLinks, null, 2),
		'',
		'EXTERNAL LINKS WITHOUT target="_blank" (low-severity style/convention choice — report as "low" unless you have evidence it breaks a real flow):',
		JSON.stringify(scanData.externalLinksSameTab, null, 2),
		'',
		'FORMS DETECTED:',
		JSON.stringify(scanData.forms, null, 2),
		'',
		'SEO ELEMENTS:',
		JSON.stringify(scanData.seoData, null, 2),
		'',
		'PASSIVE SECURITY & TRANSPORT (main document response only — read-only, no exploits):',
		'Use for category "security" when relevant: HTTPS final URL, HTTP status, recommended headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy), disclosure via Server / X-Powered-By.',
		JSON.stringify(responseSecurity, null, 2),
		'',
		`ACCESSIBILITY VIOLATIONS (axe-core top ${MAX_AXE_VIOLATIONS} by severity — nodes stripped, full data in DB):`,
		JSON.stringify(axeViolations, null, 2),
		'',
		'BROKEN UI STATES (stuck loading, bad text tokens, empty lists):',
		JSON.stringify(brokenStates, null, 2),
		'',
		'PROGRAMMATIC ROLLUP (severity counts + top findings):',
		JSON.stringify(programmaticRollup, null, 2),
		'',
		'RESPONSIVENESS DATA (per-viewport scroll + layout flags):',
		JSON.stringify(scanData.responsiveResults, null, 2),
		'',
		'NETWORK FAILURES (context only — same rule as console errors: report ONLY with a visible symptom in the screenshot/observed behaviour; ignore otherwise):',
		JSON.stringify(
			{
				httpErrors: scanData.httpErrors,
				failedRequests: scanData.failedRequests,
			},
			null,
			2,
		),
		'',
		'DETERMINISTIC PATTERN CHECKS ALREADY REPORTED (filed programmatically — do NOT duplicate these in your output):',
		JSON.stringify(verifiedPatternTitles, null, 2),
		'',
		'INTERACTION TEST RESULTS (automated checks — treat status="fail" as high-signal findings):',
		'Each entry: { id, name, status, detail }. Only failed/errored tests are listed.',
		'Report a finding for every entry not already covered by brokenStates or axe above.',
		JSON.stringify(
			(Array.isArray((interactionTests as Record<string, unknown> | null)?.results)
				? ((interactionTests as Record<string, unknown>).results as Array<Record<string, unknown>>)
						.filter((r) => r.status === 'fail' || r.status === 'error')
						.map(({ id, name, status, detail }) => ({ id, name, status, detail }))
				: []
			),
			null,
			2,
		),
		'',
		'OBSERVED INTERACTION BEHAVIOUR (real scroll / click / navigation actions performed on the page — this is GROUND TRUTH, not inference from the screenshot):',
		'When an entry describes a real observed behaviour, describe THAT behaviour in plain English in the issue (e.g. "When you scroll down, the navigation menu disappears instead of staying visible") instead of guessing from the static screenshot. Prefer this observed behaviour over any screenshot-based assumption when they conflict. Each entry: { name, scope, status, observation }.',
		JSON.stringify(
			(Array.isArray((interactionProbes as Record<string, unknown> | null)?.results)
				? ((interactionProbes as Record<string, unknown>).results as Array<Record<string, unknown>>)
						.filter((r) => r.status !== 'skip')
						.map(({ name, scope, status, observation }) => ({ name, scope, status, observation }))
				: []
			),
			null,
			2,
		),
		'',
	].join('\n');
}

/**
 * Constant placeholder for the legacy issues.fix_instructions column. The model
 * no longer produces fix guidance and the report no longer renders it, but the
 * column is NOT NULL with a minimum-length CHECK — this satisfies it (>= 20 chars)
 * without a DB migration. It is never displayed anywhere.
 */
const FIX_INSTRUCTIONS_PLACEHOLDER = 'Not included in report.';

type IssueInsert = {
	scan_id: string;
	scan_page_id: string;
	category: ClaudeIssue['category'];
	severity: ClaudeIssue['severity'];
	title: string;
	description: string;
	impact: string;
	page_section: string | null;
	fix_instructions: string;
	screenshot_url: string | null;
	is_in_free_preview: boolean;
	display_order: number;
	/** verified_pattern (deterministic + AI checklist) | suggestion | general. */
	finding_type: IssueFindingType;
};

/**
 * Build verified_pattern issues directly from the deterministic pattern checks
 * stored on `scan_pages.playwright_data.patternChecks`. No AI judgement — a
 * failing check's fixed payload becomes an issue verbatim (clamped to the DB
 * length constraints for safety).
 */
function buildVerifiedPatternIssues(
	scanId: string,
	page: ScanPageForIssuePersist,
): IssueInsert[] {
	const pd = page.playwright_data as Record<string, unknown> | null;
	const patternChecks = pd?.patternChecks as
		| { results?: Array<Record<string, unknown>> }
		| null
		| undefined;
	const results = Array.isArray(patternChecks?.results)
		? patternChecks.results
		: [];

	const issues: IssueInsert[] = [];
	for (const r of results) {
		if (r.status !== 'fail') continue;
		if (!r.category || !r.severity || !r.title || !r.description || !r.impact) {
			continue;
		}
		issues.push({
			scan_id: scanId,
			scan_page_id: page.id,
			category: r.category as ClaudeIssue['category'],
			severity: r.severity as ClaudeIssue['severity'],
			title: clampClaudeString(
				r.title,
				CLAUDE_ISSUE_STRING_LIMITS.title.min,
				CLAUDE_ISSUE_STRING_LIMITS.title.max,
			),
			description: clampClaudeString(
				r.description,
				CLAUDE_ISSUE_STRING_LIMITS.description.min,
				CLAUDE_ISSUE_STRING_LIMITS.description.max,
			),
			impact: clampClaudeString(
				r.impact,
				CLAUDE_ISSUE_STRING_LIMITS.impact.min,
				CLAUDE_ISSUE_STRING_LIMITS.impact.max,
			),
			page_section:
				typeof r.pageSection === 'string' && r.pageSection.length > 0
					? r.pageSection
					: null,
			fix_instructions: FIX_INSTRUCTIONS_PLACEHOLDER,
			// Prefer the highlighted evidence crop captured at check time; fall back
			// to the full desktop screenshot if the crop could not be produced.
			screenshot_url:
				(typeof r.cropScreenshotUrl === 'string' && r.cropScreenshotUrl) ||
				page.screenshot_desktop_url ||
				null,
			is_in_free_preview: false,
			display_order: 0,
			finding_type: 'verified_pattern',
		});
	}
	return issues;
}

/**
 * Collapse a title/section to a comparison key: lowercased, punctuation and
 * extra whitespace removed. "Footer links open pages without scrolling to top!"
 * and "Footer links open pages without scrolling to the top" collapse close
 * enough that, combined with category, they key the same.
 */
function normalizeForDedup(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9 ]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Merge near-duplicate issues before finalizing the list. Per-page Claude calls
 * routinely surface the SAME underlying problem more than once — the same
 * site-wide footer/nav defect reported on every page, or the same root cause
 * restated with slightly different wording. We treat issues sharing a category
 * and a normalized title (same affected element + same root cause) as one, and
 * keep the highest-severity instance as the representative.
 */
function dedupeIssues(issues: IssueInsert[]): IssueInsert[] {
	const byKey = new Map<string, IssueInsert>();

	for (const issue of issues) {
		const key = `${issue.category}::${normalizeForDedup(issue.title)}`;
		const existing = byKey.get(key);

		if (!existing) {
			byKey.set(key, issue);
			continue;
		}

		// Same root cause already seen. Prefer the deterministic verified_pattern
		// write-up over a general AI restatement of the same thing; otherwise keep
		// whichever is more severe so the merged issue never under-states impact.
		const rank = (i: IssueInsert): number => {
			const finding = i.finding_type === 'verified_pattern' ? 0 : 1;
			return finding * 10 + (SEVERITY_RANK[i.severity] ?? 9);
		};
		if (rank(issue) < rank(existing)) {
			byKey.set(key, issue);
		}
	}

	return Array.from(byKey.values());
}

function pickFirstMatching(
	issues: IssueInsert[],
	predicate: (issue: IssueInsert) => boolean,
): IssueInsert | null {
	const index = issues.findIndex(predicate);
	if (index === -1) return null;
	const [picked] = issues.splice(index, 1);
	return picked ?? null;
}

/**
 * Pick the FREE_PREVIEW_ISSUE_COUNT issues most likely to convince a
 * non-technical site owner that there are real problems worth fixing.
 *
 * Functional and usability problems (broken buttons/links/forms, navigation
 * issues) convert best, so they lead. Purely visual (ui_bugs) and especially
 * accessibility issues are deprioritised. Priority:
 *  1. functionality   (critical OR high) — broken things stop visitors cold
 *  2. usability_ux    (critical OR high) — confusing navigation / flows
 *  3. responsiveness  (critical OR high) — mobile breaks, widest audience
 *  4. ui_bugs         (critical OR high) — visible visual defects
 *  5. Any other critical/high EXCEPT accessibility (broadens coverage)
 *  6. Any remaining critical/high (now including accessibility)
 *  7. Anything left (sorted by display_order, already severity-ranked)
 *
 * Using pickFirstMatching removes the chosen item from `remaining` so the same
 * issue can never appear twice and we always progress toward `count`.
 */
const FREE_PREVIEW_CATEGORY_PRIORITY = [
	'functionality',
	'usability_ux',
	'responsiveness',
	'ui_bugs',
] as const;

function selectBalancedPreview(
	issues: IssueInsert[],
	count: number,
): IssueInsert[] {
	// Suggestions are soft advice — never spend a free-preview slot on one.
	const remaining = issues.filter((i) => i.finding_type !== 'suggestion');
	const selected: IssueInsert[] = [];

	const isCriticalOrHigh = (issue: IssueInsert) =>
		issue.severity === 'critical' || issue.severity === 'high';

	// 0. Verified patterns first — deterministic + AI-checklist findings are the
	//    highest-confidence, most concrete issues to show a non-technical owner,
	//    regardless of severity. They are already severity-sorted within the list.
	while (selected.length < count) {
		const next = pickFirstMatching(
			remaining,
			(issue) => issue.finding_type === 'verified_pattern',
		);
		if (!next) break;
		selected.push(next);
	}

	// 1–4. Strong converters first, in category priority order. Functional and
	//       usability issues lead; visual defects come after them.
	for (const category of FREE_PREVIEW_CATEGORY_PRIORITY) {
		if (selected.length >= count) break;
		const picked = pickFirstMatching(
			remaining,
			(issue) => issue.category === category && isCriticalOrHigh(issue),
		);
		if (picked) selected.push(picked);
	}

	// 5. Any other critical/high issue that is NOT accessibility (accessibility
	//    is the least persuasive to non-technical owners, so it waits).
	while (selected.length < count) {
		const next = pickFirstMatching(
			remaining,
			(issue) => isCriticalOrHigh(issue) && issue.category !== 'accessibility',
		);
		if (!next) break;
		selected.push(next);
	}

	// 6. Any remaining critical/high (now including accessibility).
	while (selected.length < count) {
		const next = pickFirstMatching(remaining, isCriticalOrHigh);
		if (!next) break;
		selected.push(next);
	}

	// 7. Fill with whatever remains (already sorted by display_order/severity).
	while (selected.length < count && remaining.length > 0) {
		const next = remaining.shift();
		if (!next) break;
		selected.push(next);
	}

	return selected.slice(0, count);
}

export async function clearScanIssuesForAnalysis(
	supabase: ServiceSupabase,
	scanId: string,
): Promise<void> {
	const { error: deleteError } = await supabase
		.from('issues')
		.delete()
		.eq('scan_id', scanId);

	if (deleteError) {
		console.error('[runAiAnalysisForScan] delete issues failed', deleteError);
		throw new Error(deleteError.message);
	}

	const { error: clearAiAnalysisError } = await supabase
		.from('scan_pages')
		.update({ ai_analysis: null })
		.eq('scan_id', scanId);

	if (clearAiAnalysisError) {
		console.error(
			'[runAiAnalysisForScan] clear scan_pages.ai_analysis failed',
			clearAiAnalysisError,
		);
		throw new Error(clearAiAnalysisError.message);
	}
}

async function loadScanPageRow(
	supabase: ServiceSupabase,
	scanId: string,
	pageUrl: string,
): Promise<ScanPageRow> {
	const { data: page, error } = await supabase
		.from('scan_pages')
		.select(
			'id, page_url, page_role, page_speed_data, playwright_data, axe_violations, screenshot_desktop_url, screenshot_mobile_url',
		)
		.eq('scan_id', scanId)
		.eq('page_url', pageUrl)
		.maybeSingle();

	if (error || !page) {
		throw new Error(
			error?.message ?? `No scan_pages row for ${pageUrl} (scan ${scanId})`,
		);
	}

	return page as ScanPageRow;
}

/** Screenshots are in the public scan-screenshots bucket — return URL directly. */
function resolveScreenshotUrl(ref: string | null): string | null {
	return ref ?? null;
}

export async function analyzeScanPageWithClaude(
	supabase: ServiceSupabase,
	scanId: string,
	pageUrl: string,
	websiteType: string | null,
	pkg?: ScanPackage,
): Promise<void> {
	const page = await loadScanPageRow(supabase, scanId, pageUrl);
	const scanData = page.playwright_data ?? null;
	const desktop = page.screenshot_desktop_url;
	const mobileUrl = getPrimaryMobileScreenshotUrl(page);

	if (
		!pageHasAnalyzableData({
			pageSpeedData: page.page_speed_data,
			scanData,
		})
	) {
		console.warn('[runAiAnalysisForScan] skip page (no analyzable data)', {
			scanId,
			pageUrl: page.page_url,
			hasPageSpeed: Boolean(page.page_speed_data),
			hasScanData: Boolean(scanData),
		});
		return;
	}

	const desktopSignedUrl = resolveScreenshotUrl(desktop);
	const mobileSignedUrl = resolveScreenshotUrl(mobileUrl);

	const analysisMode: AiAnalysisMode = resolveAiAnalysisMode({
		hasDesktop: Boolean(desktopSignedUrl),
		hasMobile: Boolean(mobileSignedUrl),
	});

	// Pick the cached user-text prefix that matches exactly what Claude will see.
	// Using the wrong prefix (e.g. "two images" when only one is attached) causes
	// Claude to hallucinate observations for the missing viewport.
	const cachedUserText = (() => {
		if (analysisMode === 'text_only') {
			return CLAUDE_SCAN_CACHEABLE_USER_TEXT_NO_SCREENSHOTS;
		}
		if (analysisMode === 'hybrid') {
			return desktopSignedUrl ?
					CLAUDE_SCAN_CACHEABLE_USER_TEXT_HYBRID_DESKTOP
				:	CLAUDE_SCAN_CACHEABLE_USER_TEXT_HYBRID_MOBILE;
		}
		return CLAUDE_SCAN_CACHEABLE_USER_TEXT;
	})();

	try {
		console.log('[runAiAnalysisForScan] starting claude analysis', {
			scanId,
			pageUrl: page.page_url,
			analysisMode,
			desktop: desktopSignedUrl ? desktopSignedUrl.slice(0, 80) : null,
			mobile: mobileSignedUrl ? mobileSignedUrl.slice(0, 80) : null,
		});

		const isFree = pkg === 'free';
		const dynamicBeforeImagesText = buildAnalysisPromptBeforeImages({
			pageUrl: page.page_url,
			pageRole: page.page_role,
			websiteType,
			isFree,
		});
		// axeViolations: read from playwright_data.axeViolations (v4),
		// fall back to the dedicated axe_violations DB column for older rows.
		const sdRecord =
			scanData && typeof scanData === 'object' ?
				(scanData as Record<string, unknown>)
			:	null;
		const axeViolationsData = sdRecord?.axeViolations ?? page.axe_violations ?? null;
		const dynamicAfterImagesText = buildAnalysisPromptAfterImages({
			pageSpeedData: page.page_speed_data,
			playwrightData: scanData,
			axeViolations: axeViolationsData,
			hasScreenshots: analysisMode !== 'text_only',
			isFree,
		});

		const raw = await analyzeWithClaude({
			desktopScreenshotUrl: desktopSignedUrl,
			mobileScreenshotUrl: mobileSignedUrl,
			cachedUserText,
			dynamicBeforeImagesText,
			dynamicAfterImagesText,
			scanId,
			pageUrl: page.page_url,
			// Free tier: shorter per-attempt ceiling for speed (paid keeps the default).
			...(pkg === 'free' ? { timeoutMs: FREE_CLAUDE_TIMEOUT_MS } : {}),
		});

		const issues = parseClaudeIssues(raw);

		await updateScanPageAiAnalysis(scanId, page.page_url, {
			ai_analysis: {
				issues,
				analyzed_at: new Date().toISOString(),
				status: 'ok',
				analysis_mode: analysisMode,
				screenshots_available: analysisMode !== 'text_only',
			},
		});
	} catch (error) {
		const message = getErrorMessage(error);
		const failurePayload = {
			ai_analysis: {
				status: 'failed' as const,
				analyzed_at: new Date().toISOString(),
				error: message,
			},
		};

		try {
			await updateScanPageAiAnalysis(scanId, page.page_url, failurePayload);
		} catch (saveError) {
			console.error(
				'[runAiAnalysisForScan] failed saving ai_analysis failure payload',
				{
					scanId,
					pageId: page.id,
					pageUrl: page.page_url,
					error: getErrorMessage(saveError),
				},
			);
		}

		console.error('[runAiAnalysisForScan] page analysis failed', {
			scanId,
			pageId: page.id,
			pageUrl: page.page_url,
			error: message,
		});

		// Do NOT call failScan here — that would flash the scan to 'failed'
		// even for transient errors that Inngest will retry. The failure is
		// already written to ai_analysis.status='failed' above.
		// persistScanIssuesFromAnalysis will call failScan only when ALL
		// pages have failed (no recoverable analysis).
		throw error instanceof Error ? error : new Error(message);
	}
}

type AiAnalysisRecord = {
	issues?: ClaudeIssue[];
	status?: string;
	error?: string;
};

type ScanPageForIssuePersist = {
	id: string;
	page_url: string;
	screenshot_desktop_url: string | null;
	ai_analysis: unknown;
	page_role?: string | null;
	/** Holds the deterministic patternChecks results (see buildVerifiedPatternIssues). */
	playwright_data?: unknown;
};

export async function persistScanIssuesFromAnalysis(
	supabase: ServiceSupabase,
	scanId: string,
	pagesToTest: string[] | null | undefined,
	pkg: ScanPackage,
): Promise<void> {
	const { data: pages, error: pagesError } = await supabase
		.from('scan_pages')
		.select(
			'id, page_url, screenshot_desktop_url, ai_analysis, page_role, playwright_data',
		)
		.eq('scan_id', scanId);

	if (pagesError || !pages?.length) {
		throw new Error(pagesError?.message ?? 'No scan_pages rows for analysis.');
	}

	const ordered = orderPages(
		pages as ScanPageForIssuePersist[],
		pagesToTest,
	) as ScanPageForIssuePersist[];
	let pending: IssueInsert[] = [];
	const analysisFailures: string[] = [];
	let attemptedAnalysisCount = 0;
	let successfulAnalysisCount = 0;

	for (const page of ordered) {
		// Deterministic verified-pattern issues are independent of the AI — emit
		// them even when this page's AI analysis is missing or failed.
		pending.push(...buildVerifiedPatternIssues(scanId, page));

		const analysis = page.ai_analysis as AiAnalysisRecord | null;
		if (!analysis) continue;

		if (analysis.status === 'failed') {
			attemptedAnalysisCount += 1;
			analysisFailures.push(
				`${page.page_url}: ${analysis.error ?? 'analysis_failed'}`,
			);
			continue;
		}

		if (!Array.isArray(analysis.issues)) continue;

		attemptedAnalysisCount += 1;
		successfulAnalysisCount += 1;

		for (const issue of analysis.issues) {
			const pageSection =
				issue.page_section && issue.page_section.length > 0 ?
					issue.page_section
				:	null;

			const findingType: IssueFindingType = issue.finding_type ?? 'general';
			// Suggestions are a soft, separate tier — never let one carry a
			// critical/high severity that would inflate the bug totals.
			const severity =
				findingType === 'suggestion' ? 'low' : issue.severity;

			pending.push({
				scan_id: scanId,
				scan_page_id: page.id,
				category: issue.category,
				severity,
				title: issue.title,
				description: issue.description,
				impact: issue.impact,
				page_section: pageSection,
				// "How to fix" is no longer generated or shown. The issues.fix_instructions
				// column is NOT NULL, so write a constant, never-displayed placeholder to
				// satisfy it without a schema migration (see FIX_INSTRUCTIONS_PLACEHOLDER).
				fix_instructions: FIX_INSTRUCTIONS_PLACEHOLDER,
				screenshot_url: page.screenshot_desktop_url ?? null,
				is_in_free_preview: false,
				display_order: 0,
				finding_type: findingType,
			});
		}
	}

	if (attemptedAnalysisCount > 0 && successfulAnalysisCount === 0) {
		const err = new Error(
			`AI analysis failed for all ${attemptedAnalysisCount} page(s): ${analysisFailures
				.slice(0, 3)
				.join(' | ')}`,
		);
		try {
			await failScan(supabase, scanId, err);
		} catch (markFailedError) {
			console.error('[runAiAnalysisForScan] failScan after persist failure', {
				scanId,
				error: getErrorMessage(markFailedError),
			});
		}
		throw err;
	}

	if (analysisFailures.length > 0) {
		console.warn('[runAiAnalysisForScan] completed with partial AI failures', {
			scanId,
			attemptedAnalysisCount,
			successfulAnalysisCount,
			failedAnalysisCount: analysisFailures.length,
		});
	}

	// Merge near-duplicates (same category + same root cause) before sorting,
	// previewing, and inserting — so a site-wide defect is reported once.
	const beforeDedup = pending.length;
	pending = dedupeIssues(pending);
	if (pending.length < beforeDedup) {
		console.log('[runAiAnalysisForScan] deduped issues', {
			scanId,
			before: beforeDedup,
			after: pending.length,
			merged: beforeDedup - pending.length,
		});
	}

	pending.sort((a, b) => {
		const ra = SEVERITY_RANK[a.severity] ?? 99;
		const rb = SEVERITY_RANK[b.severity] ?? 99;
		if (ra !== rb) return ra - rb;
		return a.scan_page_id.localeCompare(b.scan_page_id);
	});

	const isFree = pkg === 'free';
	const freePreviewIssues = new Set(
		isFree ? selectBalancedPreview(pending, FREE_PREVIEW_ISSUE_COUNT) : [],
	);

	pending.forEach((row, index) => {
		row.display_order = index;
		row.is_in_free_preview = isFree && freePreviewIssues.has(row);
	});

	const chunkSize = 50;

	for (let i = 0; i < pending.length; i += chunkSize) {
		const chunk = pending.slice(i, i + chunkSize);
		const { error: insertError } = await supabase.from('issues').insert(chunk);

		if (insertError) {
			console.error('[runAiAnalysisForScan] insert failed', insertError);
			throw new Error(insertError.message);
		}
	}
}

export async function runAiAnalysisForScan(
	supabase: ServiceSupabase,
	scanId: string,
	websiteType: string | null,
	pagesToTest: string[] | null | undefined,
	pkg: ScanPackage,
): Promise<void> {
	await clearScanIssuesForAnalysis(supabase, scanId);

	const urls = pagesToTest ?? [];

	// ── Analyse pages with bounded concurrency ───────────────────────────────
	// p-limit(CLAUDE_CONCURRENCY) is a true sliding window: the next page starts
	// the moment any slot frees, unlike a batch loop that waits for the slowest
	// page per batch. This removes the primary cause of 429 rate limits while
	// keeping scans fast (3 concurrent calls still parallelises most scans).
	// Per-page errors are caught independently so one failure never blocks the rest.
	const claudeLimit = createConcurrencyLimit(CLAUDE_CONCURRENCY);
	await Promise.all(
		urls.map((pageUrl) =>
			claudeLimit(() =>
				analyzeScanPageWithClaude(
					supabase,
					scanId,
					pageUrl,
					websiteType,
					pkg,
				),
			).catch((error: unknown) => {
				console.error(
					JSON.stringify({
						event: 'ai_page_analysis_error',
						scanId,
						pageUrl,
						error: error instanceof Error ? error.message : String(error),
					}),
				);
			}),
		),
	);
}
