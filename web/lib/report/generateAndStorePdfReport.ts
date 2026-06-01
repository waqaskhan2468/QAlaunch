import { Resend } from 'resend';
import { generatePdfFromHtml } from '@/lib/scan/pdf';
import { renderReportHtml } from './renderReportHtml';
import type { ReportIssue, ReportScan, ReportScanPage } from './report.types';
import type { getServiceSupabase } from '@/lib/db/supabase';

type ServiceSupabase = ReturnType<typeof getServiceSupabase>;

// ─── Config ───────────────────────────────────────────────────────────────────

const REPORT_BUCKET = process.env.SUPABASE_REPORT_BUCKET!;

/**
 * How long a signed download URL stays valid.
 * Default: 7 days (604 800 s). Override via REPORT_SIGNED_URL_TTL_SECONDS.
 */
const SIGNED_URL_TTL =
	(
		Number.isFinite(Number(process.env.REPORT_SIGNED_URL_TTL_SECONDS)) &&
		Number(process.env.REPORT_SIGNED_URL_TTL_SECONDS) > 0
	) ?
		Number(process.env.REPORT_SIGNED_URL_TTL_SECONDS)
	:	604_800;

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : 'unknown_error';
}

/**
 * Converts a URL or an already-sanitized path into a safe storage path segment.
 * e.g. "https://example.com/foo" → "example-com-foo"
 */
function sanitizeForPath(value: string): string {
	return value
		.toLowerCase()
		.replace(/^https?:\/\//, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 120);
}

/**
 * `report_pdf_url` historically stored a public URL.
 * Normalise to the bare storage object path so signing always works.
 */
function resolveObjectPath(stored: string): string {
	if (!stored.startsWith('http')) return stored;
	try {
		const u = new URL(stored);
		const prefix = `/storage/v1/object/public/${REPORT_BUCKET}/`;
		if (u.pathname.startsWith(prefix)) {
			return decodeURIComponent(u.pathname.slice(prefix.length));
		}
	} catch {
		/* ignore malformed URLs */
	}
	return stored;
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchReportData(
	supabase: ServiceSupabase,
	scanId: string,
): Promise<{
	scan: ReportScan;
	pages: ReportScanPage[];
	issues: ReportIssue[];
}> {
	const [
		{ data: scan, error: scanError },
		{ data: pages, error: pagesError },
		{ data: issues, error: issuesError },
	] = await Promise.all([
		supabase
			.from('scans')
			.select('id, url, user_email, created_at')
			.eq('id', scanId)
			.single(),
		supabase
			.from('scan_pages')
			.select('page_url, page_speed_data, playwright_data')
			.eq('scan_id', scanId),
		supabase
			.from('issues')
			.select(
				'id, category, severity, title, description, impact, page_section, fix_instructions, display_order, scan_pages(page_url)',
			)
			.eq('scan_id', scanId)
			.order('display_order', { ascending: true }),
	]);

	if (scanError || !scan) {
		throw new Error(
			`Failed to load scan: ${scanError?.message ?? 'not found'}`,
		);
	}
	if (pagesError) {
		throw new Error(`Failed to load scan pages: ${pagesError.message}`);
	}
	if (issuesError) {
		throw new Error(`Failed to load issues: ${issuesError.message}`);
	}

	const normalizedIssues: ReportIssue[] = (issues ?? []).map((row) => {
		const rel = row as {
			scan_pages?: { page_url?: string } | Array<{ page_url?: string }> | null;
		};
		const pageUrl =
			Array.isArray(rel.scan_pages) ?
				rel.scan_pages[0]?.page_url
			:	rel.scan_pages?.page_url;

		return {
			id: String((row as { id: string }).id),
			page_url: pageUrl ?? 'Unknown page',
			category: (row as { category: ReportIssue['category'] }).category,
			severity: (row as { severity: ReportIssue['severity'] }).severity,
			title: String((row as { title: string }).title),
			description: String((row as { description: string }).description),
			impact: String((row as { impact: string }).impact),
			page_section:
				(row as { page_section: string | null }).page_section ?? null,
			fix_instructions: String(
				(row as { fix_instructions: string }).fix_instructions,
			),
			display_order: Number(
				(row as { display_order: number }).display_order ?? 0,
			),
		};
	});

	const reportPages: ReportScanPage[] = (pages ?? []).map((p) => ({
		page_url: (p as { page_url: string }).page_url,
		playwright_data: (p as { playwright_data?: unknown }).playwright_data,
		page_speed_data: (p as { page_speed_data?: unknown }).page_speed_data,
	}));

	return {
		scan: scan as ReportScan,
		pages: reportPages,
		issues: normalizedIssues,
	};
}

// ─── PDF generation ───────────────────────────────────────────────────────────

async function requestPdfFromBrowser(html: string): Promise<Buffer> {
	if (!process.env.BROWSERBASE_API_KEY?.trim()) {
		throw new Error('BROWSERBASE_API_KEY is not configured.');
	}

	return generatePdfFromHtml(html);
}

// ─── Storage ──────────────────────────────────────────────────────────────────

async function uploadPdfToStorage(
	supabase: ServiceSupabase,
	scanId: string,
	targetUrl: string,
	pdfBuffer: Buffer,
): Promise<string> {
	const filePath = `${scanId}/${sanitizeForPath(targetUrl)}-qa-report.pdf`;

	const { error } = await supabase.storage
		.from(REPORT_BUCKET)
		.upload(filePath, pdfBuffer, {
			contentType: 'application/pdf',
			upsert: true,
		});

	if (error) throw new Error(`Failed to upload PDF: ${error.message}`);

	return filePath;
}

// ─── Public: signed URL ───────────────────────────────────────────────────────

/**
 * Creates a time-limited signed download URL for a stored report.
 *
 * Used in two places:
 *  1. Inngest run-scan step `send-email` — included in the delivery email.
 *  2. GET /api/scans/[scanId]/report-url — on-demand for the dashboard
 *     "Download Report" button (generates a fresh URL each time so it
 *     never expires from the user's perspective).
 */
export async function createSignedReportDownloadUrl(
	supabase: ServiceSupabase,
	objectPath: string,
): Promise<string | null> {
	if (!REPORT_BUCKET) {
		console.error('[report] SUPABASE_REPORT_BUCKET is not set');
		return null;
	}

	const { data, error } = await supabase.storage
		.from(REPORT_BUCKET)
		.createSignedUrl(resolveObjectPath(objectPath), SIGNED_URL_TTL);

	if (error) {
		console.error('[report] createSignedUrl failed', error);
		return null;
	}

	return data.signedUrl;
}

// ─── Public: email ────────────────────────────────────────────────────────────

export async function sendReportEmail(input: {
	to: string | null;
	scanId: string;
	targetUrl: string;
	pdfUrl: string | null;
}): Promise<void> {
	if (!input.to || !input.pdfUrl) {
		console.warn(
			'[report] sendReportEmail: missing recipient or URL — skipped',
			{
				to: input.to,
				hasPdfUrl: !!input.pdfUrl,
			},
		);
		return;
	}

	if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
		console.warn(
			'[report] sendReportEmail: RESEND_API_KEY or FROM_EMAIL not set — skipped',
		);
		return;
	}

	const resend = new Resend(process.env.RESEND_API_KEY);

	await resend.emails.send({
		from: process.env.FROM_EMAIL,
		to: input.to,
		subject: `Your QAlaunch report is ready — ${input.targetUrl}`,
		html: `
			<p>Hi,</p>
			<p>Your QAlaunch website audit report for <strong>${input.targetUrl}</strong> is ready.</p>
			<p>
				<a href="${input.pdfUrl}"
				   style="display:inline-block;padding:10px 20px;background:#6366f1;color:#fff;border-radius:6px;text-decoration:none;font-weight:500;">
					Download PDF report
				</a>
			</p>
			<p style="color:#6b7280;font-size:12px;">
				This link expires in 7 days. Scan ID: ${input.scanId}
			</p>
		`,
	});
}

// ─── Public: main flow ────────────────────────────────────────────────────────

export async function generateAndStorePdfReport(
	supabase: ServiceSupabase,
	scanId: string,
): Promise<{
	/** Bare storage object path inside SUPABASE_REPORT_BUCKET — not a public URL. */
	pdfStoragePath: string;
	targetUrl: string;
	userEmail: string | null;
}> {
	try {
		const { scan, pages, issues } = await fetchReportData(supabase, scanId);

		const html = renderReportHtml({ scan, pages, issues });
		const pdfBuffer = await requestPdfFromBrowser(html);
		const pdfStoragePath = await uploadPdfToStorage(
			supabase,
			scanId,
			scan.url,
			pdfBuffer,
		);

		const { error: updateError } = await supabase
			.from('scans')
			.update({ report_pdf_url: pdfStoragePath })
			.eq('id', scanId);

		if (updateError) {
			throw new Error(
				`Failed to persist report_pdf_url: ${updateError.message}`,
			);
		}

		return {
			pdfStoragePath,
			targetUrl: scan.url,
			userEmail: scan.user_email,
		};
	} catch (error: unknown) {
		throw new Error(
			`PDF generation failed: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}
