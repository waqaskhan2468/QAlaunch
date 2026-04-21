import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/db/supabase';
import { detectWebsiteType, selectPagesToTest } from '@/lib/utils/detect';
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

	// ── Mark scan as crawling ────────────────────────────────────────────
	// Status values per spec DB schema: pending | crawling | analyzing | done | failed
	await supabase.from('scans').update({ status: 'crawling' }).eq('id', scanId);

	try {
		// ── 1. Fetch homepage HTML ─────────────────────────────────────────
		const homepageHtml = await fetchHomepageHtml(targetUrl);

		// ── 2. Detect website type ─────────────────────────────────────────
		const detection = detectWebsiteType(homepageHtml, targetUrl);

		console.log('[process] detection', {
			scanId,
			type: detection.type,
			requiresAuth: detection.requiresAuth,
		});

		// ── 3. Select pages to scan ────────────────────────────────────────
		//
		// Per spec Section 3.2:
		// When requiresAuth is true (webapp), scan STILL RUNS on public pages.
		// selectPagesToTest handles this automatically — webapp returns only
		// public pages (homepage, pricing, features). Auth routes never included.
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
		// Columns written here match the spec DB schema exactly:
		//   website_type  → text  ('ecommerce' | 'business' | 'saas' | etc.)
		//   pages_to_test → jsonb (array of URL strings)
		//   status        → text  ('crawling' — next worker picks up from here)
		//
		// requiresAuth info is passed back in the response body only —
		// it is NOT a column in the spec scans table.
		await supabase
			.from('scans')
			.update({
				website_type: detection.type, // string only — never the whole object
				pages_to_test: pagesToTest, // jsonb array of URLs
				status: 'crawling', // stays crawling — Playwright VPS picks up next
			})
			.eq('id', scanId);

		// ── 5. Return response to QStash / caller ──────────────────────────
		//
		// Always 200 — scan is running.
		// When requiresAuth is true, frontend reads the auth fields and shows:
		//   - banner on results page  (spec: "Web app detected — contact us...")
		//   - note in report          (spec: "Authenticated areas were not tested")
		//   - Custom plan CTA         (spec: hello@getqalaunch.com)
		// The actual scan still runs on the public pages returned in pagesToTest.
		return NextResponse.json({
			ok: true,
			websiteType: detection.type,
			requiresAuth: detection.requiresAuth,
			pagesToTest,
			// Auth copy passed to frontend — shown as banner + note on results page
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
