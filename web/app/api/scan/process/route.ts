import { serve } from '@upstash/workflow/nextjs';
import { getServiceSupabase } from '@/lib/db/supabase';
import { fetchHomepageHtml } from '@/lib/api/fetchHomePageHtml';
import { AppError } from '@/lib/api/error';
import { detectWebsiteType } from '@/utils/detect';
import {
	selectPagesToTestWithRoles,
	type SelectedScanPage,
} from '@/utils/page-selection';
import { collectPageSpeedForPages } from '@/utils/savePageSpeedForPage';
import { runAiAnalysisForScan } from '@/lib/scan/runAiAnalysisForScan';
import {
	createSignedReportDownloadUrl,
	generateAndStorePdfReport,
	sendReportEmail,
} from '@/lib/report/generateAndStorePdfReport';
import type { ProcessPayload } from '@/types/api/process';

export const runtime = 'nodejs';

export const { POST } = serve<ProcessPayload>(async (context) => {
	const { scanId, targetUrl, package: pkg } = context.requestPayload;

	// ── 1. Mark as crawling ───────────────────────────────────────────────────
	await context.run('mark-crawling', async () => {
		const supabase = getServiceSupabase();
		const { error } = await supabase
			.from('scans')
			.update({ status: 'crawling', error_message: null })
			.eq('id', scanId);

		if (error) {
			throw new AppError(
				500,
				'scan_status_update_failed',
				'Could not mark scan as crawling.',
			);
		}
	});

	// ── 2. Detect site type and select pages ──────────────────────────────────
	const { detection, pagesToTest, selectedPages } = await context.run(
		'detect-and-select-pages',
		async () => {
			const homepageHtml = await fetchHomepageHtml(targetUrl);
			const detection = detectWebsiteType(homepageHtml, targetUrl);
			const selectedPages = selectPagesToTestWithRoles(
				homepageHtml,
				targetUrl,
				detection.type,
				pkg,
			);
			const pagesToTest = selectedPages.map((p: SelectedScanPage) => p.url);

			if (!pagesToTest.length) {
				throw new AppError(
					422,
					'no_testable_pages',
					'No public pages were found to test on this website.',
				);
			}

			return { detection, pagesToTest, selectedPages };
		},
	);

	// ── 3. Persist scan metadata and pages ────────────────────────────────────
	await context.run('persist-metadata', async () => {
		const supabase = getServiceSupabase();

		const { error: scanUpdateError } = await supabase
			.from('scans')
			.update({
				website_type: detection.type,
				pages_to_test: pagesToTest,
				status: 'crawling',
				error_message: null,
			})
			.eq('id', scanId);

		if (scanUpdateError) {
			throw new AppError(
				500,
				'scan_update_failed',
				'Failed to save scan metadata.',
			);
		}

		const { error: upsertPagesError } = await supabase
			.from('scan_pages')
			.upsert(
				selectedPages.map((p: SelectedScanPage) => ({
					scan_id: scanId,
					page_url: p.url,
					page_role: p.role,
				})),
				{ onConflict: 'scan_id,page_url' },
			);

		if (upsertPagesError) {
			throw new AppError(
				500,
				'scan_pages_prepare_failed',
				'Could not prepare pages for scanning.',
			);
		}
	});

	// ── 4. PageSpeed + Playwright scanner in parallel ─────────────────────────
	//
	// Both are independent — no shared writes, no ordering dependency.
	// Upstash Workflow natively supports Promise.all with context.run.
	await Promise.all([
		context.run('collect-pagespeed', async () => {
			const supabase = getServiceSupabase();
			await collectPageSpeedForPages(supabase, scanId, pagesToTest);
		}),

		context.run('call-scanner', async () => {
			if (!process.env.SCAN_SERVICE_URL || !process.env.SCAN_API_TOKEN) {
				throw new AppError(
					500,
					'config_missing',
					'SCAN_SERVICE_URL or SCAN_API_TOKEN is missing.',
				);
			}

			const response = await fetch(`${process.env.SCAN_SERVICE_URL}/scan`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${process.env.SCAN_API_TOKEN}`,
				},
				body: JSON.stringify({ scanId, urls: pagesToTest }),
			});

			if (!response.ok) {
				const text = await response.text().catch(() => '');
				throw new AppError(
					502,
					'scanner_error_response',
					`Scanner returned ${response.status}${text ? `: ${text}` : ''}`,
				);
			}
		}),
	]);

	// ── 5. Bail early if scanner marked the scan as failed ────────────────────
	const scanAfter = await context.run('reload-scan', async () => {
		const supabase = getServiceSupabase();
		const { data, error } = await supabase
			.from('scans')
			.select('status, website_type, pages_to_test, package')
			.eq('id', scanId)
			.single();

		if (error) {
			throw new AppError(
				500,
				'scan_reload_failed',
				'Could not reload scan after collection.',
			);
		}

		return data;
	});

	if (scanAfter?.status === 'failed') return;

	// ── 6. AI analysis ────────────────────────────────────────────────────────
	await context.run('ai-analysis', async () => {
		const supabase = getServiceSupabase();

		if (!process.env.ANTHROPIC_API_KEY) {
			await supabase
				.from('scans')
				.update({
					status: 'failed',
					error_message: 'ANTHROPIC_API_KEY is not configured.',
				})
				.eq('id', scanId);

			throw new AppError(
				500,
				'config_missing',
				'ANTHROPIC_API_KEY is missing in environment.',
			);
		}

		await runAiAnalysisForScan(
			supabase,
			scanId,
			scanAfter?.website_type ?? null,
			(scanAfter?.pages_to_test as string[] | null) ?? pagesToTest,
			pkg,
		);
	});

	// ── 7. Generate PDF and store in private bucket ───────────────────────────
	const report = await context.run('generate-pdf', async () => {
		const supabase = getServiceSupabase();
		return generateAndStorePdfReport(supabase, scanId);
	});

	// ── 8. Email signed download URL to user ──────────────────────────────────
	//
	// Email failure must NOT block mark-done — the scan is complete regardless.
	// A failed email is logged and skipped; the user can still download via
	// the dashboard (GET /api/scans/[scanId]/report-url generates a fresh URL).
	await context.run('send-email', async () => {
		const supabase = getServiceSupabase();

		const pdfUrl = await createSignedReportDownloadUrl(
			supabase,
			report.pdfStoragePath,
		);

		if (!pdfUrl) {
			console.error(
				'[workflow] signed URL generation failed — skipping email',
				{
					scanId,
					pdfStoragePath: report.pdfStoragePath,
				},
			);
			return;
		}

		try {
			await sendReportEmail({
				to: report.userEmail,
				scanId,
				targetUrl: report.targetUrl,
				pdfUrl,
			});
		} catch (err) {
			// Non-fatal: log for Resend dashboard visibility, continue to mark-done
			console.error('[workflow] report email failed — continuing', {
				scanId,
				error: err instanceof Error ? err.message : err,
			});
		}
	});

	// ── 9. Mark scan as done ──────────────────────────────────────────────────
	await context.run('mark-done', async () => {
		const supabase = getServiceSupabase();
		const { error } = await supabase
			.from('scans')
			.update({
				status: 'done',
				completed_at: new Date().toISOString(),
				error_message: null,
				...(pkg === 'free' ? { free_preview_used: true } : {}),
			})
			.eq('id', scanId);

		if (error) {
			throw new AppError(
				500,
				'scan_finalize_failed',
				'Analysis finished but could not mark scan complete.',
			);
		}
	});
});
