import { getServiceSupabase } from '@/lib/db/supabase';
import { detectWebsiteType } from '@/lib/utils/detect';
import { selectPagesToTest } from '@/lib/utils/page-selection';
import { fetchHomepageHtml } from '@/lib/api/pagespeed';
import type { ProcessPayload } from '@/types/api/process';
import { AppError, asyncHandler } from '@/lib/api/error';
import { NextResponse } from 'next/server';
import { Agent, fetch as undiciFetch } from 'undici';
export const runtime = 'nodejs';

const SCAN_SERVICE_URL = process.env.SCAN_SERVICE_URL;
const SCAN_API_TOKEN = process.env.SCAN_API_TOKEN;

// TODO: add a timeout to the fetch request to avoid hanging the process.

const SCAN_FETCH_MS = Number.parseInt(
	process.env.SCAN_FETCH_TIMEOUT_MS ?? '900000',
	10,
);

const scannerAgent = new Agent({
	connectTimeout: 30_000,
	headersTimeout: SCAN_FETCH_MS,
	bodyTimeout: SCAN_FETCH_MS,
});

export const POST = asyncHandler(async (req: Request) => {
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

	const payload = (await req.json()) as ProcessPayload;
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

	const pagesToTest = selectPagesToTest(
		homepageHtml,
		targetUrl,
		detection.type,
		pkg,
	);

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

	const pageRows = pagesToTest.map((pageUrl) => ({
		scan_id: scanId,
		page_url: pageUrl,
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


	// try {
	//     await undiciFetch(`${SCAN_SERVICE_URL}/scan`, {
	// 		method: 'POST',
	// 		headers: {
	// 			'Content-Type': 'application/json',
	// 			Authorization: `Bearer ${SCAN_API_TOKEN}`,
	// 		},
	// 		body: JSON.stringify({ scanId, urls: pagesToTest }),
	// 		dispatcher: scannerAgent,
	// 	});
	// } catch (err) {
	// 	console.error('[process] scanner fetch failed', err);
	// 	throw new AppError(
	// 		503,
	// 		'scanner_unreachable',
	// 		'Scanner is unreachable or the request timed out.',
	// 	);
	// }



	// TODO: In the future, store detection.notes and detection.banner in the database instead of only returning them in the API response.
	return NextResponse.json({
		ok: true,
		scanId,
		websiteType: detection.type,
		requiresAuth: detection.requiresAuth,
		pagesToTest,
		...(detection.requiresAuth && {
			auth: {
				notes: detection.notes,
				banner: detection.banner,
				contactUrl: detection.contactUrl,
			},
		}),
	});
});
