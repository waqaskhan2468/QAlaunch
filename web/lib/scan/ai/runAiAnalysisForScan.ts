import {
	analyzeWithClaude,
	CLAUDE_SCAN_CACHEABLE_USER_TEXT,
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
import { resolvePageScanData } from '@/lib/artifacts';
import { getArtifactBucket, getScreenshotBucket } from '@/lib/artifacts/upload';
import { failScan, toUserFacingScanError } from '@/lib/scan/fail-scan';
import { withRetry } from '@/lib/scan/services/retry';
import type { ClaudeIssue } from './types';
import type { ScanPackage } from '@/types/zod';

type ServiceSupabase = ReturnType<typeof getServiceSupabase>;

const CLAUDE_PROMPT_MAX_BROKEN_LINKS = 15;
const CLAUDE_PROMPT_MAX_EXTERNAL_LINKS = 15;

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

const DEFAULT_SCREENSHOT_SIGNED_URL_TTL_SEC = 3600;
const MIN_SCREENSHOT_SIGNED_URL_TTL_SEC = 60;
const MAX_SCREENSHOT_SIGNED_URL_TTL_SEC = 86400;

type ScanPageRow = {
	id: string;
	page_url: string;
	page_role: string | null;
	page_speed_data: unknown;
	playwright_data: unknown;
	axe_violations: unknown;
	screenshot_desktop_url: string | null;
	screenshot_mobile_url: string | null;
	artifact_path?: string | null;
};

type SupabaseStorageObjectRef = {
	bucket: string;
	path: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function getErrorMessage(error: unknown): string {
	return formatErrorWithCause(error);
}

function getScreenshotSignedUrlTtlSec(): number {
	const raw = Number.parseInt(
		process.env.SCREENSHOT_SIGNED_URL_TTL_SEC ??
			`${DEFAULT_SCREENSHOT_SIGNED_URL_TTL_SEC}`,
		10,
	);

	if (!Number.isFinite(raw)) {
		return DEFAULT_SCREENSHOT_SIGNED_URL_TTL_SEC;
	}

	return Math.min(
		MAX_SCREENSHOT_SIGNED_URL_TTL_SEC,
		Math.max(MIN_SCREENSHOT_SIGNED_URL_TTL_SEC, raw),
	);
}

function parseSupabasePublicStorageUrl(
	publicUrl: string,
): SupabaseStorageObjectRef {
	const parsed = new URL(publicUrl);
	const marker = '/storage/v1/object/public/';
	const markerIndex = parsed.pathname.indexOf(marker);

	if (markerIndex === -1) {
		throw new Error(`Invalid Supabase public screenshot URL: ${publicUrl}`);
	}

	const objectRef = parsed.pathname.slice(markerIndex + marker.length);
	const [bucket, ...pathParts] = objectRef.split('/');

	if (!bucket || pathParts.length === 0) {
		throw new Error(`Invalid Supabase public screenshot URL: ${publicUrl}`);
	}

	return {
		bucket: decodeURIComponent(bucket),
		path: pathParts.map((part) => decodeURIComponent(part)).join('/'),
	};
}

/** Keep only origin + pathname for safe logging; drop query params entirely. */
function maskSignedUrl(url: string): string {
	try {
		const { origin, pathname } = new URL(url);
		return `${origin}${pathname}`;
	} catch {
		return '[unparseable-url]';
	}
}

/**
 * Resolves a screenshot reference into a URL that Claude can fetch.
 *
 * Bucket layout:
 *   scan-screenshots  → PUBLIC  → getPublicUrl() works, URL returned as-is.
 *   scan-artifacts    → PRIVATE → getPublicUrl() generates a URL that looks
 *                                  public but returns 403. Must be signed.
 *
 * Input formats handled:
 *   1. Full https:// URL from the public scan-screenshots bucket
 *      → contains "/scan-screenshots/" in the path → return as-is.
 *   2. Full https:// URL from scan-artifacts or any other bucket
 *      → looks like /object/public/ but the bucket is private → sign it.
 *   3. Bare storage path (legacy, no http prefix)
 *      → sign using the screenshot bucket.
 */
async function resolveScreenshotUrl(
	supabase: ServiceSupabase,
	screenshotRef: string,
): Promise<string> {
	if (screenshotRef.startsWith('http')) {
		// Check if this URL is from the actual public screenshot bucket.
		// We match on the bucket name in the URL path rather than just
		// "/object/public/" because getPublicUrl() generates that prefix for
		// ALL buckets — including private ones — so the prefix alone is not
		// a reliable indicator of accessibility.
		const publicBucket = getScreenshotBucket(); // e.g. "scan-screenshots"
		if (screenshotRef.includes(`/${publicBucket}/`)) {
			// Confirmed public bucket URL — Claude can fetch it directly.
			return screenshotRef;
		}

		// URL is from a different bucket (e.g. old scan-artifacts scans).
		// Parse bucket + path and create a signed URL so Anthropic can access it.
		const parsed = parseSupabasePublicStorageUrl(screenshotRef);
		const ttlSec = getScreenshotSignedUrlTtlSec();
		console.log('[runAiAnalysisForScan] signing non-public-bucket screenshot', {
			bucket: parsed.bucket,
			path: parsed.path.slice(0, 60),
			ttlSec,
		});
		const { data, error } = await supabase.storage
			.from(parsed.bucket)
			.createSignedUrl(parsed.path, ttlSec);
		if (error || !data?.signedUrl) {
			throw new Error(
				`Failed to create signed screenshot URL: ${error?.message ?? 'missing signedUrl'}`,
			);
		}
		return data.signedUrl;
	}

	// Bare storage path (legacy format — old scans stored just the path).
	// Sign it using the screenshot bucket.
	const ttlSec = getScreenshotSignedUrlTtlSec();
	console.log('[runAiAnalysisForScan] signing legacy bare-path screenshot', {
		path: screenshotRef.slice(0, 60),
		bucket: getScreenshotBucket(),
		ttlSec,
	});
	const { data, error } = await supabase.storage
		.from(getScreenshotBucket())
		.createSignedUrl(screenshotRef, ttlSec);
	if (error || !data?.signedUrl) {
		throw new Error(
			`Failed to create signed screenshot URL: ${error?.message ?? 'missing signedUrl'}`,
		);
	}
	return data.signedUrl;
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

	if (
		type.includes('ecommerce') ||
		type.includes('shopify') ||
		type.includes('shop')
	) {
		lines.push(
			'ECOMMERCE FOCUS: Pay close attention to — product images (quality, consistency), pricing display (clarity, formatting), add-to-cart / buy CTA (prominence, contrast), trust badges and reviews (present and visible), checkout path entry (obvious next step).',
		);
	} else if (type.includes('saas') || type.includes('software')) {
		lines.push(
			'SAAS FOCUS: Pay close attention to — value proposition clarity above fold, pricing section (readable, plans clear), feature comparison (scannable), trial/sign-up CTA (prominent), social proof (logos, testimonials visible).',
		);
	} else if (type.includes('agency') || type.includes('portfolio')) {
		lines.push(
			'AGENCY/PORTFOLIO FOCUS: Pay close attention to — work showcase (images load, layout intact), contact CTA (clear and above fold or footer), case study links, client logos.',
		);
	} else if (
		type.includes('blog') ||
		type.includes('content') ||
		type.includes('news')
	) {
		lines.push(
			'CONTENT SITE FOCUS: Pay close attention to — article readability (font, line-height, measure), navigation to related content, ad placement (does it obstruct content?), mobile reading experience.',
		);
	}

	if (role.includes('landing')) {
		lines.push(
			'LANDING PAGE: Single CTA priority — check that one action dominates. Verify headline, sub-headline, and CTA are all visible above the fold on desktop. On mobile, confirm CTA is reachable without scrolling far.',
		);
	} else if (role.includes('home')) {
		lines.push(
			'HOMEPAGE: Check that each major section has a clear purpose and a visible next-step link. Verify no section is an orphan (no CTA, no link out).',
		);
	} else if (role.includes('product') || role.includes('pricing')) {
		lines.push(
			'PRODUCT/PRICING PAGE: Verify that prices are readable and plans are visually distinguished. Check that the recommended / most popular plan is visually highlighted.',
		);
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
		.map(({ nodes: _nodes, ...rest }) => rest);
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
		scanOk: pd?.scanOk,
		error: pd?.error,
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
				scanOk: scanData.scanOk,
				error: scanData.error,
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

function selectBalancedPreview(
	issues: IssueInsert[],
	count: number,
): IssueInsert[] {
	const remaining = [...issues];
	const selected: IssueInsert[] = [];

	const criticalFunctionality = pickFirstMatching(
		remaining,
		(issue) =>
			issue.category === 'functionality' && issue.severity === 'critical',
	);
	if (criticalFunctionality) selected.push(criticalFunctionality);

	const strongUsability = pickFirstMatching(
		remaining,
		(issue) =>
			issue.category === 'usability_ux' &&
			(issue.severity === 'critical' || issue.severity === 'high'),
	);
	if (strongUsability) selected.push(strongUsability);

	const strongResponsiveness = pickFirstMatching(
		remaining,
		(issue) =>
			issue.category === 'responsiveness' &&
			(issue.severity === 'critical' || issue.severity === 'high'),
	);
	if (strongResponsiveness) selected.push(strongResponsiveness);

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
			'id, page_url, page_role, page_speed_data, playwright_data, axe_violations, screenshot_desktop_url, screenshot_mobile_url, artifact_path',
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

async function tryResolveScreenshotUrl(
	supabase: ServiceSupabase,
	ref: string | null,
): Promise<string | null> {
	if (!ref) return null;

	try {
		return await withRetry(() => resolveScreenshotUrl(supabase, ref), {
			attempts: 3,
			delayMs: 1_000,
		});
	} catch (error: unknown) {
		console.warn('[runAiAnalysisForScan] screenshot sign failed (non-fatal)', {
			ref: ref.slice(0, 80),
			error: getErrorMessage(error),
		});
		return null;
	}
}

export async function analyzeScanPageWithClaude(
	supabase: ServiceSupabase,
	scanId: string,
	pageUrl: string,
	websiteType: string | null,
	pkg?: ScanPackage,
): Promise<void> {
	const page = await loadScanPageRow(supabase, scanId, pageUrl);
	const scanData = await resolvePageScanData({
		artifact_path: page.artifact_path,
		playwright_data: page.playwright_data,
		axe_violations: page.axe_violations,
		scan_id: scanId,
		page_url: pageUrl,
	});
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

	const [desktopSignedUrl, mobileSignedUrl] = await Promise.all([
		tryResolveScreenshotUrl(supabase, desktop),
		tryResolveScreenshotUrl(supabase, mobileUrl),
	]);

	const analysisMode: AiAnalysisMode = resolveAiAnalysisMode({
		hasDesktop: Boolean(desktopSignedUrl),
		hasMobile: Boolean(mobileSignedUrl),
	});

	const cachedUserText =
		analysisMode === 'text_only' ?
			CLAUDE_SCAN_CACHEABLE_USER_TEXT_NO_SCREENSHOTS
		:	CLAUDE_SCAN_CACHEABLE_USER_TEXT;

	try {
		console.log('[runAiAnalysisForScan] starting claude analysis', {
			scanId,
			pageUrl: page.page_url,
			analysisMode,
			desktop: desktopSignedUrl ? maskSignedUrl(desktopSignedUrl) : null,
			mobile: mobileSignedUrl ? maskSignedUrl(mobileSignedUrl) : null,
		});

		const dynamicBeforeImagesText = buildAnalysisPromptBeforeImages({
			pageUrl: page.page_url,
			pageRole: page.page_role,
			websiteType,
		});
		// scanData = buildPlaywrightPayloadFromArtifact() result (new artifact format)
		// OR page.playwright_data (legacy DB column for old scans)
		// Either way it is the correct object to pass as playwrightData.
		// axeViolations: new artifact format includes it as .axeViolations;
		// legacy format falls back to page.axe_violations DB column.
		const sdRecord =
			scanData && typeof scanData === 'object' ?
				(scanData as Record<string, unknown>)
			:	null;
		const axeViolationsData =
			sdRecord?.axeViolations ?? page.axe_violations ?? null;
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

		try {
			await failScan(supabase, scanId, message);
		} catch (markFailedError) {
			console.error('[runAiAnalysisForScan] failScan after AI error', {
				scanId,
				pageUrl: page.page_url,
				error: getErrorMessage(markFailedError),
			});
		}

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

	// ── Analyse all pages in parallel ────────────────────────────────────────
	// Previously this was a sequential for-loop. For a 5-page scan where Claude
	// takes 30–60 s each, the old approach added 2–4 minutes of avoidable serial
	// waiting. Promise.all lets all pages hit the Anthropic API concurrently.
	// Note: Inngest's ai-page:* steps run per page already enforce isolation, so a single page
	// failure won't cascade. Each page gets its own try/catch.
	await Promise.all(
		urls.map((pageUrl) =>
			analyzeScanPageWithClaude(supabase, scanId, pageUrl, websiteType, pkg).catch(
				(error: unknown) => {
					console.error(
						JSON.stringify({
							ts: new Date().toISOString(),
							level: 'error',
							event: 'ai:page_analysis_failed',
							scanId,
							pageUrl,
							error: error instanceof Error ? error.message : String(error),
						}),
					);
				},
			),
		),
	);
}
