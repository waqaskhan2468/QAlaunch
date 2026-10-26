import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/db/supabase';
import {
	computeHealthScore,
	gradeFromScore,
	labelFromScore,
} from '@/lib/scoring/health';
import { buildProofOfWork } from '@/lib/scan/proof-of-work';

export const runtime = 'nodejs';

type IssueRow = {
	id: string;
	scan_id: string;
	scan_page_id: string | null;
	category: string;
	severity: string;
	title: string;
	description: string;
	impact: string;
	page_section: string | null;
	fix_instructions: string | null;
	screenshot_url: string | null;
	is_in_free_preview: boolean | null;
	display_order: number | null;
	finding_type: string | null;
	/** 0–1 model confidence (1 for deterministic checks); null on historical rows. */
	confidence: number | null;
	/** Evidence overlay box in screenshot pixel space; null when not applicable. */
	bounding_box: unknown;
	created_at: string | null;
};

type ScanRow = {
	id: string;
	url: string | null;
	package: string | null;
	status: string | null;
	error_message: string | null;
	payment_status: string | null;
	report_pdf_url: string | null;
	user_email: string | null;
	website_type: string | null;
	pages_to_test: string[] | null;
	created_at: string | null;
	completed_at: string | null;
};

type PageRow = {
	id: string;
	page_url: string;
	page_role: string | null;
	screenshot_desktop_url: string | null;
	screenshot_mobile_url: string | null;
	ai_analysis: {
		status?: string;
		analysis_mode?: string;
		screenshots_available?: boolean;
		issues?: unknown[];
	} | null;
	playwright_data: unknown;
};

/** Suggestions are advisory — excluded from the health score + bug totals. */
const isBug = (issue: IssueRow): boolean => issue.finding_type !== 'suggestion';

/** "w…s@gmail.com": enough for the owner to recognise, useless to anyone else. */
function maskEmail(email: string | null): string | null {
	if (!email) return null;
	const at = email.indexOf('@');
	if (at < 1) return null;
	const local = email.slice(0, at);
	const domain = email.slice(at);
	const shown = local.length <= 2 ? local[0] : `${local[0]}…${local[local.length - 1]}`;
	return `${shown}${domain}`;
}

/**
 * GET /api/scan/status/[scanId]
 *
 * Public by design — the result page polls it with nothing but the scan id —
 * so it returns only what that page needs. It used to return `select *` on the
 * scan and every page row, which handed anyone holding a link the visitor's
 * email address and, on free scans, the raw axe/console/interaction data
 * behind the locked findings. Issue text is the paid product; the data that
 * produced it is not a free download.
 */
export async function GET(
	_: Request,
	{ params }: { params: Promise<{ scanId: string }> },
) {
	const { scanId } = await params;
	const supabase = getServiceSupabase();

	const { data: scanRow, error: scanError } = await supabase
		.from('scans')
		.select(
			'id, url, package, status, error_message, payment_status, report_pdf_url, user_email, website_type, pages_to_test, created_at, completed_at',
		)
		.eq('id', scanId)
		.single();

	if (scanError || !scanRow) {
		return NextResponse.json({ error: 'not_found' }, { status: 404 });
	}
	const scanData = scanRow as ScanRow;

	const { data: issues, error: issueError } = await supabase
		.from('issues')
		.select(
			'id, scan_id, scan_page_id, category, severity, title, description, impact, page_section, fix_instructions, screenshot_url, is_in_free_preview, display_order, finding_type, confidence, bounding_box, created_at',
		)
		.eq('scan_id', scanId)
		.order('display_order', { ascending: true });

	if (issueError) {
		return NextResponse.json({ error: issueError.message }, { status: 500 });
	}

	const { data: pageRows, error: pagesError } = await supabase
		.from('scan_pages')
		.select(
			'id, page_url, page_role, screenshot_desktop_url, screenshot_mobile_url, ai_analysis, playwright_data',
		)
		.eq('scan_id', scanId);

	if (pagesError) {
		return NextResponse.json({ error: pagesError.message }, { status: 500 });
	}

	const scan = {
		id: scanData.id,
		url: scanData.url,
		package: scanData.package,
		status: scanData.status,
		error_message: scanData.error_message,
		payment_status: scanData.payment_status,
		/** True once the PDF exists; the file itself is served via /api/scan/report-url. */
		report_ready: Boolean(scanData.report_pdf_url),
		user_email_masked: maskEmail(scanData.user_email),
		website_type: scanData.website_type,
		pages_to_test: scanData.pages_to_test ?? [],
		created_at: scanData.created_at,
		completed_at: scanData.completed_at,
	};

	// What the scanner did, pre-computed here so the raw payload never leaves
	// the server. The "how we tested this" panel reads only these numbers.
	const pages = ((pageRows ?? []) as PageRow[]).map((page) => ({
		id: page.id,
		page_url: page.page_url,
		page_role: page.page_role,
		screenshot_desktop_url: page.screenshot_desktop_url,
		screenshot_mobile_url: page.screenshot_mobile_url,
		ai_analysis:
			page.ai_analysis ?
				{
					status: page.ai_analysis.status,
					analysis_mode: page.ai_analysis.analysis_mode,
					screenshots_available: page.ai_analysis.screenshots_available,
					issue_count: Array.isArray(page.ai_analysis.issues) ?
						page.ai_analysis.issues.length
					:	undefined,
				}
			:	null,
		proof: buildProofOfWork({
			playwrightData: page.playwright_data,
			hasDesktopScreenshot: Boolean(page.screenshot_desktop_url),
			hasMobileScreenshot: Boolean(page.screenshot_mobile_url),
		}),
	}));

	const allIssues = (issues ?? []) as IssueRow[];
	const healthScore = computeHealthScore(
		allIssues.filter(isBug).map((issue) => issue.severity),
	);
	const healthGrade = gradeFromScore(healthScore);
	const healthLabel = labelFromScore(healthScore);
	const isFree = scanData.package === 'free';

	if (!isFree) {
		// A paid package that has not been paid for has no issues yet, but the
		// shape stays the same so the checkout pages can poll it.
		return NextResponse.json({
			scan,
			pages,
			issues: allIssues,
			lockedIssues: [],
			totalIssueCount: allIssues.length,
			visibleIssueCount: allIssues.length,
			lockedIssueCount: 0,
			healthScore,
			healthGrade,
			healthLabel,
		});
	}

	// Free preview: the three chosen issues in full minus the fix (the fix is
	// what the paid report adds), the rest as title-only teasers.
	const visibleIssues = allIssues
		.filter((issue) => issue.is_in_free_preview)
		.map((issue) => ({ ...issue, fix_instructions: null }));
	const previewHealthScore = computeHealthScore(
		visibleIssues.filter(isBug).map((issue) => issue.severity),
	);
	const lockedIssues = allIssues
		.filter((issue) => !issue.is_in_free_preview)
		.map((issue) => ({
			id: issue.id,
			category: issue.category,
			severity: issue.severity,
			title: issue.title,   // exposed as teaser — no description/impact/fix
			finding_type: issue.finding_type,
			isLocked: true as const,
		}));

	return NextResponse.json({
		scan,
		pages,
		issues: visibleIssues,
		lockedIssues,
		totalIssueCount: allIssues.length,
		visibleIssueCount: visibleIssues.length,
		lockedIssueCount: lockedIssues.length,
		healthScore,
		healthGrade,
		healthLabel,
		previewHealthScore,
	});
}
