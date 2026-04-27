import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/db/supabase';
import { fetchHomepageHtml } from '@/lib/api/pagespeed';
import { AppError, asyncHandler } from '@/lib/api/error';
import { detectWebsiteType } from '@/lib/utils/detect';
import { selectPagesToTestWithRoles } from '@/lib/utils/page-selection';
import type { ProcessPayload } from '@/types/api/process';

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
	const abortController = new AbortController();
	const timeout = setTimeout(() => {
		abortController.abort();
	}, 900000); // 15 minutes

	try {
		
		await fetch(`${SCAN_SERVICE_URL}/scan`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${SCAN_API_TOKEN}`,
			},
			body: JSON.stringify({ scanId, urls }),
			signal: abortController.signal,
		});
	} catch (err) {
		console.error('[process] scanner fetch failed', err);
		throw new AppError(
			503,
			'scanner_unreachable',
			'Scanner is unreachable or the request timed out.',
		);
	}
}

export const POST = asyncHandler(async (req: Request) => {
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

	const homepageHtml = await fetchHomepageHtml(targetUrl).catch((err) => {
		console.error('[process] homepage fetch failed', { targetUrl, err });
		throw new AppError(
			502,
			'homepage_fetch_failed',
			'Could not access the target website homepage. Please check URL and try again.',
		);
	});

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

   await callScanner(scanId, pagesToTest);

	return NextResponse.json({
		ok: true,
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
});
