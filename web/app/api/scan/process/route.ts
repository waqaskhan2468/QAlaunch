import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/db/supabase';
import { detectWebsiteType } from '@/lib/utils/detect';
import { selectPagesToTest } from '@/lib/utils/page-selection';
import { fetchHomepageHtml } from '@/lib/api/pagespeed';
import type { ScanPackage } from '@/types/zod';

export const runtime = 'nodejs';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

type ProcessPayload = {
	scanId: string;
	package: ScanPackage;
	targetUrl: string;
	userEmail?: string | null;
};

// ─────────────────────────────────────────────
// ROUTE HANDLER
// ─────────────────────────────────────────────

export async function POST(req: Request) {
	const bodyText = await req.text();

	// Uncomment when QStash signature verification is ready:
	// if (!(await verifyQStashRequest(req, bodyText))) {
	//   return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
	// }

	const payload = JSON.parse(bodyText) as ProcessPayload;
	const { scanId, targetUrl } = payload;
	const supabase = getServiceSupabase();

	// Mark scan as crawling — spec status values: pending|crawling|analyzing|done|failed
	await supabase.from('scans').update({ status: 'crawling' }).eq('id', scanId);

	try {
		// 1) Fetch homepage HTML (simple fetch + cheerio pipeline in utils)
		const homepageHtml = await fetchHomepageHtml(targetUrl);

		// 2) Detect website type + auth presence
		const detection = detectWebsiteType(homepageHtml, targetUrl);

		console.log('[process] detection', {
			scanId,
			type: detection.type,
			requiresAuth: detection.requiresAuth,
		});

		// 3) Select pages by package + website type
		// Auth/private routes are filtered in page-selection via isPublicPage().
		const pagesToTest = selectPagesToTest(
			homepageHtml,
			targetUrl,
			detection.type,
			payload.package,
		);

		console.log('[process] pages selected', {
			scanId,
			type: detection.type,
			requiresAuth: detection.requiresAuth,
			count: pagesToTest.length,
			pages: pagesToTest,
		});

		// 4) Persist scan metadata for downstream workers
		await supabase
			.from('scans')
			.update({
				website_type: detection.type,
				pages_to_test: pagesToTest,
				status: 'crawling',
				error_message: null,
			})
			.eq('id', scanId);

		// 5) Return payload for frontend
		// If requiresAuth=true, frontend should show:
		// - auth.banner on results page
		// - auth.notes in report body
		// - contact CTA using auth.contactUrl
		return NextResponse.json({
			ok: true,
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
	} catch (error) {
		const message = error instanceof Error ? error.message : 'unknown_error';

		console.error('[process] scan failed', { scanId, error: message });

		await supabase
			.from('scans')
			.update({
				status: 'failed',
				error_message: message,
			})
			.eq('id', payload.scanId);

		return NextResponse.json({ error: message }, { status: 500 });
	}
}
