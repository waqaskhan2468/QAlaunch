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

/**
 * Public origin where static brand assets (`/public/brand/*`) are served.
 * Both the Resend email and the headless PDF render fetch the logo over HTTP,
 * so a relative path will not resolve — they need an absolute URL. Mirrors the
 * origin precedence used by `getInngestServeOrigin()`.
 */
function getPublicAssetOrigin(): string {
	const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
	if (appUrl) return appUrl.replace(/\/$/, '');
	const vercel = process.env.VERCEL_URL?.trim();
	if (vercel) return `https://${vercel.replace(/\/$/, '')}`;
	return 'https://getqalaunch.com';
}

/** White-text wordmark PNG — sits on the dark email/PDF header surfaces. */
const BRAND_LOGO_DARK_BG_URL = `${getPublicAssetOrigin()}/brand/qalaunch-logo-dark-bg@2x.png`;

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : 'unknown_error';
}

/**
 * Serialises an unknown error (including Supabase `StorageError` /
 * `StorageApiError`, which carry useful non-enumerable extras like
 * `status` / `statusCode`) into a plain object safe for structured logging.
 * `Error.message`/`.name`/`.stack` are non-enumerable, so a bare `{...error}`
 * spread loses them — pull them out explicitly.
 */
function describeError(error: unknown): Record<string, unknown> {
	if (error instanceof Error) {
		const extras: Record<string, unknown> = {};
		for (const key of Object.keys(error)) {
			extras[key] = (error as unknown as Record<string, unknown>)[key];
		}
		// Supabase storage errors expose these but they are not always own-keys.
		const maybe = error as unknown as {
			status?: unknown;
			statusCode?: unknown;
		};
		if (maybe.status !== undefined) extras.status = maybe.status;
		if (maybe.statusCode !== undefined) extras.statusCode = maybe.statusCode;

		return {
			name: error.name,
			message: error.message,
			stack: error.stack,
			...extras,
		};
	}
	return { message: String(error) };
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
				'id, category, severity, title, description, impact, page_section, display_order, scan_pages(page_url)',
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
	if (!REPORT_BUCKET) {
		throw new Error(
			'SUPABASE_REPORT_BUCKET is not set — cannot upload report PDF. ' +
				'Set the env var to an existing Supabase storage bucket (e.g. "reports").',
		);
	}

	const filePath = `${scanId}/${sanitizeForPath(targetUrl)}-qa-report.pdf`;

	const { error } = await supabase.storage
		.from(REPORT_BUCKET)
		.upload(filePath, pdfBuffer, {
			contentType: 'application/pdf',
			upsert: true,
		});

	if (error) {
		// Log the full storage error — `.message` alone hides the status code
		// ("Bucket not found" → 404, RLS/permission → 403) that pinpoints whether
		// the bucket is missing or the service-role key lacks access.
		console.error('[report] PDF upload to storage failed', {
			scanId,
			bucket: REPORT_BUCKET,
			filePath,
			pdfBytes: pdfBuffer.byteLength,
			error: describeError(error),
		});
		throw new Error(`Failed to upload PDF: ${error.message}`);
	}

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
	issueCount: number;
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
		// Display name so inboxes show "QAlaunch", not a bare address.
		from: 'QAlaunch <contact@getqalaunch.com>',
		to: input.to,
		subject: `Your QAlaunch audit report is ready — ${input.targetUrl}`,
		html: buildReportEmailHtml({
			websiteUrl: input.targetUrl,
			issueCount: input.issueCount,
			reportUrl: input.pdfUrl,
			scanId: input.scanId,
		}),
	});
}

// ─── Email template ─────────────────────────────────────────────────────────

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

/**
 * Designed HTML email delivered with the report PDF link.
 * Table-based layout + inline CSS only — email clients do not support
 * external stylesheets or modern layout (fl/grid).
 */
function buildReportEmailHtml(input: {
	websiteUrl: string;
	issueCount: number;
	reportUrl: string;
	scanId: string;
}): string {
	const websiteUrl = escapeHtml(input.websiteUrl);
	const reportUrl = escapeHtml(input.reportUrl);
	const scanId = escapeHtml(input.scanId);
	const issueLabel = `${input.issueCount} issue${input.issueCount === 1 ? '' : 's'}`;

	const features = [
		'Every issue ranked by severity and business impact',
		'A plain-English explanation of what each issue means and why it matters',
		'Issues found across functionality, usability, mobile, performance, SEO, and accessibility',
		'An overall health score and a clear priority order for what to fix first',
	];

	const featureRows = features
		.map(
			(text) => `
					<tr>
						<td style="padding:5px 0;vertical-align:top;width:26px;color:#22C55E;font-size:15px;font-weight:700;line-height:22px;">&#10003;</td>
						<td style="padding:5px 0;vertical-align:top;color:#18293A;font-size:15px;line-height:22px;">${escapeHtml(text)}</td>
					</tr>`,
		)
		.join('');

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light only" />
<title>Your QAlaunch audit report is ready</title>
</head>
<body style="margin:0;padding:0;background:#F4F8FC;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F8FC;">
	<tr>
		<td align="center" style="padding:0;">

			<!-- Header bar -->
			<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#09111F;">
				<tr>
					<td align="center" style="padding:28px 24px;">
						<img src="${BRAND_LOGO_DARK_BG_URL}" alt="QAlaunch" width="180" height="50" style="display:block;margin:0 auto;width:180px;height:auto;border:0;outline:none;text-decoration:none;" />
						<div style="font-family:'Segoe UI',Arial,Helvetica,sans-serif;font-size:14px;color:#6B8AA3;margin-top:10px;">Expert website auditing</div>
					</td>
				</tr>
			</table>

			<!-- Main card -->
			<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;margin:24px auto;background:#FFFFFF;border:1px solid #DDE6F0;border-radius:14px;box-shadow:0 10px 30px -12px rgba(15,23,42,0.12);overflow:hidden;">

				<!-- Success banner -->
				<tr>
					<td style="padding:16px 32px;background:#ECFDF5;border-bottom:1px solid #BBF7D0;font-family:'Segoe UI',Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#16A34A;">
						&#10003; Your report is ready
					</td>
				</tr>

				<!-- Greeting -->
				<tr>
					<td style="padding:28px 32px 8px;font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#18293A;">
						<p style="margin:0 0 12px;font-size:16px;font-weight:600;">Hi there,</p>
						<p style="margin:0 0 12px;font-size:15px;line-height:23px;color:#3B536B;">Your website audit for <strong style="color:#18293A;">${websiteUrl}</strong> is complete.</p>
						<p style="margin:0 0 4px;font-size:15px;line-height:23px;color:#3B536B;">We found <strong style="color:#18293A;">${issueLabel}</strong> across your website. Your full report includes:</p>
					</td>
				</tr>

				<!-- Feature list -->
				<tr>
					<td style="padding:8px 32px 4px;">
						<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:'Segoe UI',Arial,Helvetica,sans-serif;">${featureRows}
						</table>
					</td>
				</tr>

				<!-- Download button -->
				<tr>
					<td align="center" style="padding:24px 32px 8px;">
						<a href="${reportUrl}" style="display:inline-block;background:#1847A8;color:#FFFFFF;font-family:'Segoe UI',Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;text-decoration:none;padding:15px 32px;border-radius:10px;">Download Your PDF Report &rarr;</a>
					</td>
				</tr>

				<!-- Expiry notice -->
				<tr>
					<td align="center" style="padding:4px 32px 24px;font-family:'Segoe UI',Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#6B8AA3;">
						This download link expires in 7 days.<br />
						Scan ID: ${scanId}
					</td>
				</tr>

				<!-- Secondary upsell: human-reviewed deeper test -->
				<tr>
					<td style="padding:8px 32px 4px;">
						<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F8FC;border:1px solid #E2EBF5;border-radius:10px;">
							<tr>
								<td style="padding:16px 18px;font-family:'Segoe UI',Arial,Helvetica,sans-serif;">
									<p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#3B536B;">Want a human to dig deeper?</p>
									<p style="margin:0;font-size:13px;line-height:21px;color:#6B8AA3;">Our automated scan catches what most visitors actually experience &mdash; but if you&#39;d like an experienced QA engineer to manually test specific flows (checkout, signup, a feature you&#39;re worried about), reply to this email and we&#39;ll get back to you with details.</p>
								</td>
							</tr>
						</table>
					</td>
				</tr>

				<!-- Divider -->
				<tr>
					<td style="padding:0 32px;">
						<div style="border-top:1px solid #DDE6F0;font-size:0;line-height:0;">&nbsp;</div>
					</td>
				</tr>

				<!-- Help section -->
				<tr>
					<td style="padding:22px 32px 30px;font-family:'Segoe UI',Arial,Helvetica,sans-serif;">
						<p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#18293A;">Need help?</p>
						<p style="margin:0 0 8px;font-size:14px;line-height:22px;color:#3B536B;">If you have any questions about your report or need a rescan, reply to this email or contact us at <a href="mailto:contact@getqalaunch.com" style="color:#1847A8;text-decoration:none;font-weight:600;">contact@getqalaunch.com</a>.</p>
						<p style="margin:0;font-size:14px;line-height:22px;color:#3B536B;">We typically respond within 1 business day.</p>
					</td>
				</tr>
			</table>

			<!-- Footer -->
			<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;margin:0 auto 28px;background:#F4F8FC;">
				<tr>
					<td align="center" style="padding:8px 32px 0;font-family:'Segoe UI',Arial,Helvetica,sans-serif;font-size:12px;line-height:20px;color:#6B8AA3;">
						<div>&copy; 2026 QAlaunch &middot; getqalaunch.com</div>
						<div style="margin:6px 0;">
							<a href="https://getqalaunch.com/privacy" style="color:#6B8AA3;text-decoration:underline;">Privacy Policy</a>
							&nbsp;&middot;&nbsp;
							<a href="https://getqalaunch.com/refund" style="color:#6B8AA3;text-decoration:underline;">Refund Policy</a>
						</div>
						<div>You received this email because you purchased a QAlaunch report.</div>
					</td>
				</tr>
			</table>

		</td>
	</tr>
</table>
</body>
</html>`;
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
	// Track which stage we're in so a failure log names the real culprit.
	// toUserFacingScanError() later flattens everything to a generic phrase,
	// so this structured log is the only place the true cause is visible.
	let stage: 'fetch-data' | 'render-html' | 'generate-pdf' | 'upload' | 'persist-url' =
		'fetch-data';
	try {
		const { scan, pages, issues } = await fetchReportData(supabase, scanId);

		stage = 'render-html';
		const html = renderReportHtml({
			scan,
			pages,
			issues,
			logoUrl: BRAND_LOGO_DARK_BG_URL,
		});

		stage = 'generate-pdf';
		const pdfBuffer = await requestPdfFromBrowser(html);

		stage = 'upload';
		const pdfStoragePath = await uploadPdfToStorage(
			supabase,
			scanId,
			scan.url,
			pdfBuffer,
		);

		stage = 'persist-url';
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
		console.error('[report] generateAndStorePdfReport failed', {
			scanId,
			stage,
			reportBucket: REPORT_BUCKET || '(unset)',
			error: describeError(error),
		});
		throw new Error(
			`PDF generation failed at ${stage}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}
