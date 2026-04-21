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
		// ── 1. Fetch homepage HTML ─────────────────────────────────────────
		const homepageHtml = await fetchHomepageHtml(targetUrl);

		// ── 2. Detect website type + auth presence ─────────────────────────
		const detection = detectWebsiteType(homepageHtml, targetUrl);

		console.log('[process] detection', {
			scanId,
			type: detection.type,
			requiresAuth: detection.requiresAuth,
		});

		// ── 3. Select pages ────────────────────────────────────────────────
		//
		// Per spec Section 3.2:
		// Even when requiresAuth is true, scan STILL RUNS on public pages.
		// selectPagesToTest always returns only public pages — login/signup/
		// dashboard routes are filtered by isPublicPage() automatically.
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

		// ── 4. Persist to DB ───────────────────────────────────────────────
		//
		// Columns written match the spec DB schema exactly:
		//   website_type  → text  e.g. 'saas', 'ecommerce', 'business'
		//   pages_to_test → jsonb array of URL strings
		//   status        → 'crawling' (Playwright VPS picks up from here)
		//   error_message → null (cleared on success)
		//
		// requiresAuth, banner, notes, contactUrl are NOT DB columns —
		// they live in the response body for the frontend to consume.
		await supabase
			.from('scans')
			.update({
				website_type: detection.type,
				pages_to_test: pagesToTest,
				status: 'crawling',
				error_message: null,
			})
			.eq('id', scanId);

		// ── 5. Return response ─────────────────────────────────────────────
		//
		// Always 200 — scan is running on public pages regardless of requiresAuth.
		//
		// When requiresAuth is true, the frontend must:
		//   - Show detection.auth.banner on the results page (per spec)
		//   - Show detection.auth.notes in the report body (per spec)
		//   - Show "contact us" CTA with detection.auth.contactUrl
		//   - Make clear login/signup areas were NOT tested
		return NextResponse.json({
			ok: true,
			websiteType: detection.type,
			requiresAuth: detection.requiresAuth,
			pagesToTest,
			// Auth copy for the frontend — NOT stored in DB
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

		// Per spec DB schema: error_message populated when status = 'failed'
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

