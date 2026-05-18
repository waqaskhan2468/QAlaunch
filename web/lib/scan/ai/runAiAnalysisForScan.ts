import {
	analyzeWithClaude,
	CLAUDE_SCAN_CACHEABLE_USER_TEXT,
	parseClaudeIssues,
} from './claude';
import type { getServiceSupabase } from '@/lib/db/supabase';
import {
	formatErrorWithCause,
	updateScanPageAiAnalysis,
} from '@/lib/db/supabase-retry';
import type { ClaudeIssue } from './types';
import type { ScanPackage } from '@/types/zod';

type ServiceSupabase = ReturnType<typeof getServiceSupabase>;

const SEVERITY_RANK: Record<string, number> = {
	critical: 0,
	high: 1,
	medium: 2,
	low: 3,
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
	screenshot_mobile_slice_urls: string[] | null;
	screenshot_responsive_slices: unknown;
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

async function createSignedScreenshotUrl(
	supabase: ServiceSupabase,
	publicUrl: string,
): Promise<string> {
	const { bucket, path } = parseSupabasePublicStorageUrl(publicUrl);
	const ttlSec = getScreenshotSignedUrlTtlSec();

	console.log('[runAiAnalysisForScan] creating signed URL', {
		bucket,
		path,
		ttlSec,
	});

	const { data, error } = await supabase.storage
		.from(bucket)
		.createSignedUrl(path, ttlSec);

	if (error || !data?.signedUrl) {
		throw new Error(
			`Failed to create signed screenshot URL: ${error?.message ?? 'missing signedUrl'}`,
		);
	}

	return data.signedUrl;
}

function getIphone14SliceUrlsFromResponsiveSlices(
	responsiveSlices: unknown,
): string[] {
	if (!Array.isArray(responsiveSlices)) return [];

	const iPhone14 = responsiveSlices.find((entry) => {
		if (!isRecord(entry)) return false;
		return entry.viewport === 'iPhone 14';
	});
	if (!isRecord(iPhone14) || !Array.isArray(iPhone14.slice_urls)) return [];

	return iPhone14.slice_urls.filter(
		(url): url is string => typeof url === 'string' && url.length > 0,
	);
}

/** One mobile screenshot URL for Claude (full-page capture preferred). */
function getPrimaryMobileScreenshotUrl(page: ScanPageRow): string | null {
	const fromDirectColumn = Array.isArray(page.screenshot_mobile_slice_urls) ?
		page.screenshot_mobile_slice_urls.filter(
			(url): url is string => typeof url === 'string' && url.length > 0,
		)
	: [];

	const fromResponsiveSlices =
		fromDirectColumn.length > 0 ?
			[]
		:	getIphone14SliceUrlsFromResponsiveSlices(page.screenshot_responsive_slices);

	const fromSingleMobile =
		fromDirectColumn.length === 0 &&
		fromResponsiveSlices.length === 0 &&
		typeof page.screenshot_mobile_url === 'string' &&
		page.screenshot_mobile_url.length > 0 ?
			[page.screenshot_mobile_url]
		:	[];

	const merged = [...fromDirectColumn, ...fromResponsiveSlices, ...fromSingleMobile];
	const deduped = Array.from(new Set(merged));

	return deduped[0] ?? null;
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

	if (type.includes('ecommerce') || type.includes('shopify') || type.includes('shop')) {
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
	} else if (type.includes('blog') || type.includes('content') || type.includes('news')) {
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
	const websiteTypeFocus = buildWebsiteTypeFocus(input.websiteType, input.pageRole);

	return [
		'CONTEXT:',
		`- Page URL: ${input.pageUrl}`,
		`- Page role: ${input.pageRole ?? 'unknown'}`,
		`- Website type: ${input.websiteType ?? 'unknown'}`,
		...(websiteTypeFocus ? ['', websiteTypeFocus] : []),
		'',
	].join('\n');
}

/** Large JSON payload after screenshots (not prompt-cached). */
function buildAnalysisPromptAfterImages(input: {
	pageSpeedData: unknown;
	playwrightData: unknown;
	axeViolations: unknown;
}): string {
	const pd = input.playwrightData as Record<string, unknown> | null;
	const links = pd?.links as Record<string, unknown> | undefined;
	const brokenLinks = links?.brokenLinks;
	const allLinks = Array.isArray(links?.links) ? links.links : [];
	const brokenStates = pd?.brokenStates ?? null;
	const programmaticRollup = pd?.programmaticRollup ?? null;
	const responseSecurity = pd?.responseSecurity ?? null;
	const externalLinksSameTab = allLinks.filter((link) => {
		if (!isRecord(link)) return false;
		return link.isExternal === true && link.target !== '_blank';
	});

	const scanData = {
		consoleMessages: pd?.consoleMessages ?? [],
		brokenLinks: brokenLinks ?? [],
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

	return [
		'STRUCTURED SCAN DATA (same page as screenshots above):',
		'',
		'PERFORMANCE METRICS (Google PageSpeed):',
		JSON.stringify(input.pageSpeedData, null, 2),
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
		'ACCESSIBILITY VIOLATIONS (axe-core — prioritise critical > serious > moderate > minor):',
		JSON.stringify(input.axeViolations, null, 2),
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
			'id, page_url, page_role, page_speed_data, playwright_data, axe_violations, screenshot_desktop_url, screenshot_mobile_url, screenshot_mobile_slice_urls, screenshot_responsive_slices',
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

export async function analyzeScanPageWithClaude(
	supabase: ServiceSupabase,
	scanId: string,
	pageUrl: string,
	websiteType: string | null,
	pkg?: ScanPackage,
): Promise<void> {
	const page = await loadScanPageRow(supabase, scanId, pageUrl);
	const desktop = page.screenshot_desktop_url;
	const mobileUrl = getPrimaryMobileScreenshotUrl(page);

	if (!desktop || !mobileUrl) {
		console.warn('[runAiAnalysisForScan] skip page (missing screenshots)', {
			scanId,
			pageUrl: page.page_url,
			hasDesktop: Boolean(desktop),
			hasMobile: Boolean(mobileUrl),
		});
		return;
	}

	try {
		const [desktopSignedUrl, mobileSignedUrl] = await Promise.all([
			createSignedScreenshotUrl(supabase, desktop),
			createSignedScreenshotUrl(supabase, mobileUrl),
		]);

		console.log('[runAiAnalysisForScan] pre-claude image URLs', {
			scanId,
			pageUrl: page.page_url,
			desktop: maskSignedUrl(desktopSignedUrl),
			mobile: maskSignedUrl(mobileSignedUrl),
		});

		const dynamicBeforeImagesText = buildAnalysisPromptBeforeImages({
			pageUrl: page.page_url,
			pageRole: page.page_role,
			websiteType,
		});
		const dynamicAfterImagesText = buildAnalysisPromptAfterImages({
			pageSpeedData: page.page_speed_data,
			playwrightData: page.playwright_data,
			axeViolations: page.axe_violations,
		});

		const raw = await analyzeWithClaude({
			desktopScreenshotUrl: desktopSignedUrl,
			mobileScreenshotUrl: mobileSignedUrl,
			cachedUserText: CLAUDE_SCAN_CACHEABLE_USER_TEXT,
			dynamicBeforeImagesText,
			dynamicAfterImagesText,
			scanId,
			pageUrl: page.page_url,
		});

		const issues = parseClaudeIssues(raw);

		await updateScanPageAiAnalysis(page.id, { issues });
	} catch (error) {
		const message = getErrorMessage(error);
		const failurePayload = {
			status: 'failed' as const,
			analyzed_at: new Date().toISOString(),
			error: message,
		};

		try {
			await updateScanPageAiAnalysis(page.id, failurePayload);
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
		throw new Error(
			`AI analysis failed for all ${attemptedAnalysisCount} page(s): ${analysisFailures
				.slice(0, 3)
				.join(' | ')}`,
		);
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
	for (const pageUrl of urls) {
		await analyzeScanPageWithClaude(supabase, scanId, pageUrl, websiteType);
	}

	await persistScanIssuesFromAnalysis(supabase, scanId, pagesToTest, pkg);
}
