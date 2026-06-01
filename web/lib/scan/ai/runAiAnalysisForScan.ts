import pLimit from 'p-limit';
import {
	analyzeWithClaude,
	CLAUDE_SCAN_CACHEABLE_USER_TEXT,
	CLAUDE_SCAN_CACHEABLE_USER_TEXT_HYBRID_DESKTOP,
	CLAUDE_SCAN_CACHEABLE_USER_TEXT_HYBRID_MOBILE,
	CLAUDE_SCAN_CACHEABLE_USER_TEXT_NO_SCREENSHOTS,
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
import type { ClaudeIssue } from './types';
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

/** Page-specific text placed before signed screenshot URLs (not prompt-cached). */
function buildAnalysisPromptBeforeImages(input: {
	pageUrl: string;
	pageRole: string | null;
	websiteType: string | null;
}): string {
	const websiteTypeFocus = buildWebsiteTypeFocus(
		input.websiteType,
		input.pageRole,
	);

	return [
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
function trimAxeViolations(raw: unknown): unknown {
	if (!Array.isArray(raw)) return raw;

	const sorted = [...(raw as AxeViolation[])].sort((a, b) => {
		const ra = AXE_IMPACT_RANK[a.impact ?? ''] ?? 99;
		const rb = AXE_IMPACT_RANK[b.impact ?? ''] ?? 99;
		return ra - rb;
	});

	return sorted
		.slice(0, MAX_AXE_VIOLATIONS)
		// Strip nodes (verbose HTML) and tags (WCAG category codes) — useless to Claude.
		.map(({ nodes: _nodes, tags: _tags, ...rest }) => rest);
}

/** Large JSON payload after screenshots (not prompt-cached). */
function buildAnalysisPromptAfterImages(input: {
	pageSpeedData: unknown;
	playwrightData: unknown;
	axeViolations: unknown;
	hasScreenshots: boolean;
}): string {
	const pd = input.playwrightData as Record<string, unknown> | null;
	const links = pd?.links as Record<string, unknown> | undefined;
	const brokenLinks = links?.brokenLinks;
	const allLinks = Array.isArray(links?.links) ? links.links : [];
	const brokenStates = pd?.brokenStates ?? null;
	const programmaticRollup = pd?.programmaticRollup ?? null;
	const responseSecurity = pd?.responseSecurity ?? null;

	const externalLinksSameTab = allLinks
		.filter((link) => {
			if (!isRecord(link)) return false;
			return link.isExternal === true && link.target !== '_blank';
		})
		.slice(0, CLAUDE_PROMPT_MAX_EXTERNAL_LINKS);

	const brokenLinksForPrompt =
		Array.isArray(brokenLinks) ?
			(brokenLinks as unknown[]).slice(0, CLAUDE_PROMPT_MAX_BROKEN_LINKS)
		:	[];

	// Cap console messages to avoid prompt bloat from noisy pages
	const rawConsoleMessages = pd?.consoleMessages ?? [];
	const consoleMessages =
		Array.isArray(rawConsoleMessages) ?
			rawConsoleMessages.slice(0, MAX_CONSOLE_MESSAGES)
		:	rawConsoleMessages;

	// Trim axe violations: sort by severity, strip nodes, cap at 20
	const axeViolations = trimAxeViolations(input.axeViolations);

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
		'JAVASCRIPT CONSOLE ERRORS:',
		JSON.stringify(scanData.consoleMessages, null, 2),
		'',
		'BROKEN / FAILED LINKS (HTTP 4xx/5xx):',
		JSON.stringify(scanData.brokenLinks, null, 2),
		'',
		'EXTERNAL LINKS WITHOUT target="_blank":',
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
		'NETWORK FAILURES:',
		JSON.stringify(
			{
				httpErrors: scanData.httpErrors,
				failedRequests: scanData.failedRequests,
			},
			null,
			2,
		),
		'',
	].join('\n');
}

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
};

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
 * Pick the FREE_PREVIEW_ISSUE_COUNT issues most likely to convince a visitor
 * that there are real problems worth fixing. Priority:
 *  1. Broken functionality (critical OR high) — things that stop visitors cold
 *  2. Visible UI bug     (critical OR high) — things visitors can clearly see
 *  3. Mobile/responsive break (critical OR high) — reaches the widest audience
 *  4. Any remaining critical or high severity issue (broadens coverage)
 *  5. Anything left (sorted by display_order, already severity-ranked)
 *
 * Using pickFirstMatching removes the chosen item from `remaining` so the same
 * issue can never appear twice and we always progress toward `count`.
 */
function selectBalancedPreview(
	issues: IssueInsert[],
	count: number,
): IssueInsert[] {
	const remaining = [...issues];
	const selected: IssueInsert[] = [];

	// 1. Broken functionality — functional or broken issues affect every visitor
	const brokenFunctionality = pickFirstMatching(
		remaining,
		(issue) =>
			issue.category === 'functionality' &&
			(issue.severity === 'critical' || issue.severity === 'high'),
	);
	if (brokenFunctionality) selected.push(brokenFunctionality);

	// 2. UI bug — visible defects build immediate distrust
	if (selected.length < count) {
		const uiBug = pickFirstMatching(
			remaining,
			(issue) =>
				issue.category === 'ui_bugs' &&
				(issue.severity === 'critical' || issue.severity === 'high'),
		);
		if (uiBug) selected.push(uiBug);
	}

	// 3. Responsiveness/mobile break — majority of traffic is mobile
	if (selected.length < count) {
		const mobileBreak = pickFirstMatching(
			remaining,
			(issue) =>
				issue.category === 'responsiveness' &&
				(issue.severity === 'critical' || issue.severity === 'high'),
		);
		if (mobileBreak) selected.push(mobileBreak);
	}

	// 4. Fill with any other critical/high issue (covers usability, seo, perf, etc.)
	while (selected.length < count) {
		const criticalOrHigh = pickFirstMatching(
			remaining,
			(issue) => issue.severity === 'critical' || issue.severity === 'high',
		);
		if (!criticalOrHigh) break;
		selected.push(criticalOrHigh);
	}

	// 5. Fill with whatever remains (already sorted by display_order/severity)
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

		const dynamicBeforeImagesText = buildAnalysisPromptBeforeImages({
			pageUrl: page.page_url,
			pageRole: page.page_role,
			websiteType,
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
		});

		const raw = await analyzeWithClaude({
			desktopScreenshotUrl: desktopSignedUrl,
			mobileScreenshotUrl: mobileSignedUrl,
			cachedUserText,
			dynamicBeforeImagesText,
			dynamicAfterImagesText,
			scanId,
			pageUrl: page.page_url,
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
};

export async function persistScanIssuesFromAnalysis(
	supabase: ServiceSupabase,
	scanId: string,
	pagesToTest: string[] | null | undefined,
	pkg: ScanPackage,
): Promise<void> {
	const { data: pages, error: pagesError } = await supabase
		.from('scan_pages')
		.select('id, page_url, screenshot_desktop_url, ai_analysis, page_role')
		.eq('scan_id', scanId);

	if (pagesError || !pages?.length) {
		throw new Error(pagesError?.message ?? 'No scan_pages rows for analysis.');
	}

	const ordered = orderPages(
		pages as ScanPageForIssuePersist[],
		pagesToTest,
	) as ScanPageForIssuePersist[];
	const pending: IssueInsert[] = [];
	const analysisFailures: string[] = [];
	let attemptedAnalysisCount = 0;
	let successfulAnalysisCount = 0;

	for (const page of ordered) {
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

			pending.push({
				scan_id: scanId,
				scan_page_id: page.id,
				category: issue.category,
				severity: issue.severity,
				title: issue.title,
				description: issue.description,
				impact: issue.impact,
				page_section: pageSection,
				fix_instructions: issue.fix_instructions,
				screenshot_url: page.screenshot_desktop_url ?? null,
				is_in_free_preview: false,
				display_order: 0,
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
	const claudeLimit = pLimit(CLAUDE_CONCURRENCY);
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
