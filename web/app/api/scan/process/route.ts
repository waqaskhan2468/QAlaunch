import { NextResponse } from 'next/server';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { getServiceSupabase } from '@/lib/db/supabase';
import { fetchHomepageHtml } from '@/lib/api/fetchHomePageHtml';
import { AppError, asyncHandler } from '@/lib/api/error';
import { detectWebsiteType } from '@/lib/utils/detect';
import { selectPagesToTestWithRoles } from '@/lib/utils/page-selection';
import type { ProcessPayload } from '@/types/api/process';
import { collectPageSpeedForPages } from '@/lib/utils/savePageSpeedForPage';
import { runAiAnalysisForScan } from '@/lib/scan/runAiAnalysisForScan';

export const runtime = 'nodejs';

const SCAN_SERVICE_URL = process.env.SCAN_SERVICE_URL;
const SCAN_API_TOKEN = process.env.SCAN_API_TOKEN;

function validateProcessPayload(payload: ProcessPayload): ProcessPayload {
	const { scanId, targetUrl, package: pkg } = payload;

	if (!scanId) {
		throw new AppError(400, 'missing_scan_id', 'scanId is required.');
	}
	if (!targetUrl) {
		throw new AppError(400, 'missing_target_url', 'targetUrl is required.');
	}
	if (!pkg) {
		throw new AppError(400, 'missing_package', 'package is required.');
	}

	return payload;
}

async function callScanner(scanId: string, urls: string[]): Promise<void> {
	if (!SCAN_SERVICE_URL) {
		throw new AppError(
			500,
			'config_missing',
			'SCAN_SERVICE_URL is missing in environment.',
		);
	}
	if (!SCAN_API_TOKEN) {
		throw new AppError(
			500,
			'config_missing',
			'SCAN_API_TOKEN is missing in environment.',
		);
	}

	try {
		const response = await fetch(`${SCAN_SERVICE_URL}/scan`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${SCAN_API_TOKEN}`,
			},
			body: JSON.stringify({ scanId, urls }),
		});

		if (!response.ok) {
			const text = await response.text().catch(() => '');
			throw new AppError(
				502,
				'scanner_error_response',
				`Scanner returned ${response.status}${text ? `: ${text}` : ''}`,
			);
		}
	} catch (err) {
		if (err instanceof AppError) throw err;
		console.error('[process] scanner fetch failed', err);
		throw new AppError(
			503,
			'scanner_unreachable',
			'Scanner is unreachable or the request timed out.',
		);
	}
}

const processHandler = asyncHandler(async (req: Request) => {
	const payload = validateProcessPayload((await req.json()) as ProcessPayload);
	const { scanId, targetUrl, package: pkg } = payload;

	const supabase = getServiceSupabase();

	const { error: setCrawlingError } = await supabase
		.from('scans')
		.update({ status: 'crawling', error_message: null })
		.eq('id', scanId);

	if (setCrawlingError) {
		console.error('[process] set crawling failed', setCrawlingError);
		throw new AppError(
			500,
			'scan_status_update_failed',
			'Could not mark scan as crawling.',
		);
	}

	const homepageHtml = await fetchHomepageHtml(targetUrl);
	const detection = detectWebsiteType(homepageHtml, targetUrl);
	const selectedPages = selectPagesToTestWithRoles(
		homepageHtml,
		targetUrl,
		detection.type,
		pkg,
	);

	const pagesToTest = selectedPages.map((page) => page.url);

	if (!pagesToTest.length) {
		throw new AppError(
			422,
			'no_testable_pages',
			'No public pages were found to test on this website.',
		);
	}

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
		console.error('[process] scan metadata update failed', scanUpdateError);
		throw new AppError(
			500,
			'scan_update_failed',
			'Failed to save scan metadata.',
		);
	}

	const pageRows = selectedPages.map((page) => ({
		scan_id: scanId,
		page_url: page.url,
		page_role: page.role,
	}));

	const { error: upsertPagesError } = await supabase
		.from('scan_pages')
		.upsert(pageRows, { onConflict: 'scan_id,page_url' });

	if (upsertPagesError) {
		console.error('[process] scan_pages upsert failed', upsertPagesError);
		throw new AppError(
			500,
			'scan_pages_prepare_failed',
			'Could not prepare pages for scanning.',
		);
	}


		await Promise.all([
			collectPageSpeedForPages(supabase, scanId, pagesToTest),
			callScanner(scanId, pagesToTest),
		]);

		const { data: scanAfter, error: scanAfterError } = await supabase
			.from('scans')
			.select('status, website_type, pages_to_test, package')
			.eq('id', scanId)
			.single();

		if (scanAfterError) {
			console.error('[process] reload scan failed', scanAfterError);
			throw new AppError(
				500,
				'scan_reload_failed',
				'Could not reload scan after collection.',
			);
		}

		if (scanAfter?.status === 'failed') {
			return NextResponse.json({ ok: true, skipped: 'scan_failed' });
		}

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
		).catch(async (err: unknown) => {
			const message =
				err instanceof Error ? err.message : 'AI analysis failed unexpectedly.';
			await supabase
				.from('scans')
				.update({
					status: 'failed',
					error_message: message.slice(0, 500),
				})
				.eq('id', scanId);
			throw err instanceof AppError ? err : (
					new AppError(500, 'ai_analysis_failed', message)
				);
		});

		const { error: doneError } = await supabase
			.from('scans')
			.update({
				status: 'done',
				completed_at: new Date().toISOString(),
				error_message: null,
				...(pkg === 'free' ? { free_preview_used: true } : {}),
			})
			.eq('id', scanId);

		if (doneError) {
			console.error('[process] mark scan done failed', doneError);
			throw new AppError(
				500,
				'scan_finalize_failed',
				'Analysis finished but could not mark the scan complete.',
			);
		}

	// TODO: will be add the db column and add the data in db (auth detection)
	console.log('auth detection', {
		scanId,
		websiteType: detection.type,
		requiresAuth: detection.requiresAuth,
		pagesToTest,
		selectedPages,
		...(detection.requiresAuth && {
			auth: {
				notes: detection.notes,
				banner: detection.banner,
				contactUrl: detection.contactUrl,
			},
		}),
	});

	return NextResponse.json({
		ok: true,
	});
});

export const POST = verifySignatureAppRouter(processHandler);
