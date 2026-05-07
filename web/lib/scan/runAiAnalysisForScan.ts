import { analyzeWithClaude, parseClaudeIssues } from '@/lib/api/claude';
import type { getServiceSupabase } from '@/lib/db/supabase';
import type { ClaudeIssue } from '@/types/claude';
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
};

type SupabaseStorageObjectRef = {
	bucket: string;
	path: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : 'Unknown error';
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

/** Redact query-string values from a URL for safe logging (keeps origin + pathname). */
function maskSignedUrl(url: string): string {
	try {
		const parsed = new URL(url);
		const params = new URLSearchParams();

		for (const key of parsed.searchParams.keys()) {
			params.set(key, '[redacted]');
		}

		parsed.search = params.toString();
		return parsed.toString();
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

	// Log parsed storage ref so we can verify path resolution is correct.
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

function getResponsiveScreenshotUrls(playwrightData: unknown): string[] {
	const pd = playwrightData as Record<string, unknown> | null;
	const responsive = pd?.responsive;

	if (!Array.isArray(responsive)) {
		return [];
	}

	const seen = new Set<string>();

	return responsive
		.map((item) => {
			if (!item || typeof item !== 'object') {
				return null;
			}

			const row = item as Record<string, unknown>;
			const screenshotUrl = row.screenshot_url;

			if (typeof screenshotUrl !== 'string' || screenshotUrl.length === 0) {
				return null;
			}

			if (seen.has(screenshotUrl)) {
				return null;
			}

			seen.add(screenshotUrl);
			return screenshotUrl;
		})
		.filter((url): url is string => Boolean(url));
}

function orderPages(
	pages: ScanPageRow[],
	pagesToTest: string[] | null | undefined,
): ScanPageRow[] {
	if (!pagesToTest?.length) {
		return [...pages];
	}

	const byUrl = new Map(pages.map((p) => [p.page_url, p]));
	const ordered: ScanPageRow[] = [];
	const seen = new Set<string>();

	for (const url of pagesToTest) {
		const p = byUrl.get(url);

		if (p) {
			ordered.push(p);
			seen.add(p.id);
		}
	}

	for (const p of pages) {
		if (!seen.has(p.id)) {
			ordered.push(p);
		}
	}

	return ordered;
}

function buildAnalysisPrompt(input: {
	pageUrl: string;
	pageRole: string | null;
	websiteType: string | null;
	pageSpeedData: unknown;
	playwrightData: unknown;
	axeViolations: unknown;
}): string {
	const pd = input.playwrightData as Record<string, unknown> | null;
	const links = pd?.links as Record<string, unknown> | undefined;
	const brokenLinks = links?.brokenLinks;
	const allLinks = Array.isArray(links?.links) ? links.links : [];
	const externalLinksSameTab = allLinks.filter((link) => {
		if (!isRecord(link)) {
			return false;
		}

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
		'Analyze this webpage and identify all quality issues.',
		'',
		'CONTEXT:',
		`- Page URL: ${input.pageUrl}`,
		`- Page role: ${input.pageRole ?? 'unknown'}`,
		`- Website type: ${input.websiteType ?? 'unknown'}`,
		'',
		'PERFORMANCE METRICS (from Google PageSpeed):',
		JSON.stringify(input.pageSpeedData, null, 2),
		'',
		'JAVASCRIPT CONSOLE ERRORS:',
		JSON.stringify(scanData.consoleMessages, null, 2),
		'',
		'BROKEN/FAILED LINKS (HTTP 4xx/5xx):',
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
		'ACCESSIBILITY VIOLATIONS (axe-core):',
		JSON.stringify(input.axeViolations, null, 2),
		'',
		'RESPONSIVENESS ISSUES:',
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
		'SCREENSHOTS: Desktop, mobile, and any responsive screenshots are provided above.',
		'Analyze them visually for UI bugs, alignment issues, color contrast, text visibility, broken images, and layout problems.',
		'',
		'Return JSON only in the exact shape described in the system prompt.',
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
	if (index === -1) {
		return null;
	}

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
		if (!next) {
			break;
		}
		selected.push(next);
	}

	return selected.slice(0, count);
}

export async function runAiAnalysisForScan(
	supabase: ServiceSupabase,
	scanId: string,
	websiteType: string | null,
	pagesToTest: string[] | null | undefined,
	pkg: ScanPackage,
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

	const { data: pages, error: pagesError } = await supabase
		.from('scan_pages')
		.select(
			'id, page_url, page_role, page_speed_data, playwright_data, axe_violations, screenshot_desktop_url, screenshot_mobile_url',
		)
		.eq('scan_id', scanId);

	if (pagesError || !pages?.length) {
		throw new Error(pagesError?.message ?? 'No scan_pages rows for analysis.');
	}

	const ordered = orderPages(pages as ScanPageRow[], pagesToTest);
	const pending: IssueInsert[] = [];
	const analysisFailures: string[] = [];
	let attemptedAnalysisCount = 0;
	let successfulAnalysisCount = 0;

	for (const page of ordered) {
		const desktop = page.screenshot_desktop_url;
		const mobile = page.screenshot_mobile_url;

		if (!desktop || !mobile) {
			console.warn('[runAiAnalysisForScan] skip page (missing screenshots)', {
				scanId,
				pageUrl: page.page_url,
			});
			continue;
		}

		attemptedAnalysisCount += 1;

		try {
			const responsivePublicUrls = getResponsiveScreenshotUrls(
				page.playwright_data,
			);
			const mobileHandledByResponsive = responsivePublicUrls.includes(mobile);

			// Create signed URLs for all screenshots (no base64 download needed).
			const [desktopSignedUrl, mobileSignedUrl, responsiveSignedUrls] =
				await Promise.all([
					createSignedScreenshotUrl(supabase, desktop),
					!mobileHandledByResponsive ?
						createSignedScreenshotUrl(supabase, mobile)
					:	Promise.resolve(null),
					Promise.all(
						responsivePublicUrls.map((url) =>
							createSignedScreenshotUrl(supabase, url),
						),
					),
				]);

			// Debug log: confirm resolved URLs right before the Claude request.
			console.log('[runAiAnalysisForScan] pre-claude image URLs', {
				scanId,
				pageUrl: page.page_url,
				desktopSignedUrl: maskSignedUrl(desktopSignedUrl),
				mobileSignedUrl:
					mobileSignedUrl ? maskSignedUrl(mobileSignedUrl) : null,
				responsiveSignedUrls: responsiveSignedUrls.map(maskSignedUrl),
			});

			const prompt = buildAnalysisPrompt({
				pageUrl: page.page_url,
				pageRole: page.page_role,
				websiteType,
				pageSpeedData: page.page_speed_data,
				playwrightData: page.playwright_data,
				axeViolations: page.axe_violations,
			});

			const raw = await analyzeWithClaude({
				desktopScreenshotUrl: desktopSignedUrl,
				mobileScreenshotUrl: mobileSignedUrl ?? undefined,
				responsiveScreenshotUrls: responsiveSignedUrls,
				prompt,
				scanId,
				pageUrl: page.page_url,
			});

			const issues = parseClaudeIssues(raw);

			const { error: aiAnalysisUpdateError } = await supabase
				.from('scan_pages')
				.update({
					ai_analysis: {
						issues,
					},
				})
				.eq('id', page.id);

			if (aiAnalysisUpdateError) {
				throw new Error(
					`Failed to save ai_analysis for page ${page.page_url}: ${aiAnalysisUpdateError.message}`,
				);
			}

			successfulAnalysisCount += 1;

			for (const issue of issues) {
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
					screenshot_url: desktop,
					is_in_free_preview: false,
					display_order: 0,
				});
			}
		} catch (error) {
			const message = getErrorMessage(error);
			analysisFailures.push(`${page.page_url}: ${message}`);

			const { error: aiAnalysisFailureUpdateError } = await supabase
				.from('scan_pages')
				.update({
					ai_analysis: {
						status: 'failed',
						analyzed_at: new Date().toISOString(),
						error: message,
					},
				})
				.eq('id', page.id);

			if (aiAnalysisFailureUpdateError) {
				console.error(
					'[runAiAnalysisForScan] failed saving ai_analysis failure payload',
					{
						scanId,
						pageId: page.id,
						pageUrl: page.page_url,
						error: aiAnalysisFailureUpdateError.message,
					},
				);
			}

			console.error('[runAiAnalysisForScan] page analysis failed', {
				scanId,
				pageId: page.id,
				pageUrl: page.page_url,
				error: message,
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

		if (ra !== rb) {
			return ra - rb;
		}

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
