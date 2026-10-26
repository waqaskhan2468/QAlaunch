import { NextResponse } from 'next/server';
import {
	normalizeUrl,
	urlHash,
	isPrivateUrl,
	resolvesToPrivateAddress,
} from '@/lib/utils/url';
import { getServiceSupabase } from '@/lib/db/supabase';
import { scanStartSchema } from '@/types/zod';
import { AppError, asyncHandler } from '@/lib/api/error';
import { assertScanStartAllowed } from '@/lib/api/scan-start-rate-limit';
import { queueScanJob } from '@/lib/api/queue-scan-job';
import { editorUrlMessage, validateScanTarget } from '@/lib/scan/validate-target';
import { isBlockedDomain } from '@/lib/scan/blocklist';
import { logFunnelEvent } from '@/lib/analytics/funnel';

export const runtime = 'nodejs';

const FREE_PREVIEW_USED_MESSAGE =
	'You have already used your free preview for this website. Your earlier results are still available — unlock the full report to see everything.';

/**
 * The free scan a paid order is placed from, when it checks out: it must be a
 * finished free scan of the SAME site, or the paid report would inherit
 * findings for a different page. Returns null (never throws) so a stale or
 * forged id simply means "no source", and the purchase goes ahead as a fresh
 * scan.
 */
async function resolveSourceScan(
	supabase: ReturnType<typeof getServiceSupabase>,
	sourceScanId: string | undefined,
	urlHashOfTarget: string,
): Promise<{ id: string; user_email: string | null } | null> {
	if (!sourceScanId) return null;
	const { data } = await supabase
		.from('scans')
		.select('id, package, status, url_hash, user_email')
		.eq('id', sourceScanId)
		.maybeSingle();
	if (!data || data.package !== 'free' || data.status !== 'done') return null;
	if (data.url_hash !== urlHashOfTarget) return null;
	return { id: data.id, user_email: data.user_email ?? null };
}

export const POST = asyncHandler(async (req: Request) => {
	const body = await req.json();

	const parsed = scanStartSchema.safeParse(body);
	if (!parsed.success) {
		throw new AppError(
			400,
			'invalid_request',
			'Please check your input and try again.',
			parsed.error.flatten(),
		);
	}

	const { url, package: pkg, email, acknowledgePublicOnly, attribution, sourceScanId } =
		parsed.data;
	const normalized = normalizeUrl(url);

	if (isPrivateUrl(normalized)) {
		throw new AppError(
			400,
			'private_url_not_allowed',
			'Private or local URLs are not allowed. Please enter a public website URL.',
		);
	}

	// A public-looking hostname can still resolve to a private address. The
	// scanner would fetch whatever it points at, so look it up before anything
	// else does.
	if (await resolvesToPrivateAddress(normalized)) {
		throw new AppError(
			400,
			'private_url_not_allowed',
			'This address points at a private network, so it cannot be scanned. Please enter a public website URL.',
		);
	}

	// Blocklist: reject major established sites the submitter can't own (free and
	// paid alike). Auditing one only wastes cloud-browser + AI budget and yields a
	// useless report. Runs before rate limiting and before any scan row is created.
	if (isBlockedDomain(normalized)) {
		throw new AppError(
			400,
			'blocked_domain',
			"This looks like an established site rather than one you own or manage. QAlaunch is built for auditing your own projects — try your site's URL instead.",
		);
	}

	const supabase = getServiceSupabase();
	const hash = urlHash(normalized);

	await assertScanStartAllowed(supabase, req, { email, package: pkg });

	// ── Pre-scan validation gate (PAID only) ───────────────────────────────────
	// Paid scans validate synchronously *before* charging: reject unreachable
	// targets and confirm public-only scanning for login/web-app homepages. Runs
	// after rate limiting (so it can't be abused as a URL fetcher).
	//
	// FREE scans intentionally SKIP this slow live fetch here so the submit
	// response is instant (only the blocklist + one indexed rate-limit query run
	// before responding). The identical reachability / login-gate check instead
	// runs as the first step of the Inngest pipeline — see
	// lib/scan/steps/checkReachability and run-scan's 'check-reachability' step.
	// A paid order placed from a finished free scan of the same site skips the
	// live gate: that site was reachable minutes ago, and the extra fetch only
	// added a second or two to the moment someone has their card out.
	const sourceScan =
		pkg !== 'free' ? await resolveSourceScan(supabase, sourceScanId, hash) : null;

	if (pkg !== 'free' && !sourceScan) {
		const validation = await validateScanTarget(normalized);

		if (validation.status === 'unreachable') {
			return NextResponse.json(
				{
					ok: false,
					code: 'unreachable',
					message:
						"We couldn't load this website. Please check the URL and try again.",
				},
				{ status: 422 },
			);
		}

		if (validation.status === 'editor_url') {
			return NextResponse.json(
				{ ok: false, code: 'editor_url', message: editorUrlMessage(validation) },
				{ status: 422 },
			);
		}

		// Testing public pages is still useful for paid; confirm before proceeding.
		if (validation.isWebApp && !acknowledgePublicOnly) {
			return NextResponse.json(
				{
					ok: false,
					code: 'confirm_public_only',
					message:
						"This looks like a web application with user accounts. QAlaunch tests public-facing pages only — nothing behind login. We'll test what's visible before sign-in. Continue, or cancel?",
				},
				{ status: 200 },
			);
		}
	}

	// The id of the earlier free scan travels with the 409 so the result page
	// can show those results again instead of a dead end. A returning visitor
	// is the most likely person on the site to buy; "free preview already
	// used" with no way back to what they saw was sending them away.
	const findUsedFreePreview = async (): Promise<string | null> => {
		const { data: existing, error: freeCheckError } = await supabase
			.from('scans')
			.select('id')
			.eq('url_hash', hash)
			.eq('package', 'free')
			.eq('free_preview_used', true)
			.order('created_at', { ascending: false })
			.limit(1);

		if (freeCheckError) {
			console.error('[scan/start] free preview check failed', freeCheckError);
			throw new AppError(
				500,
				'free_check_failed',
				'Unable to validate free plan eligibility right now.',
			);
		}
		return existing?.[0]?.id ?? null;
	};

	const freePreviewUsedResponse = (existingScanId: string | null) =>
		NextResponse.json(
			{
				ok: false,
				code: 'free_preview_used',
				message: FREE_PREVIEW_USED_MESSAGE,
				existingScanId,
			},
			{ status: 409 },
		);

	if (pkg === 'free') {
		const existingScanId = await findUsedFreePreview();
		if (existingScanId) return freePreviewUsedResponse(existingScanId);
	}

	const insertRow = {
		url: normalized,
		url_hash: hash,
		package: pkg,
		status: 'pending',
		user_email: email ?? null,
		payment_status: pkg === 'free' ? 'free' : 'pending',
		free_preview_used: false,
		// Where this visitor came from. Null throughout for direct traffic,
		// which is the truthful record rather than a gap to fill in.
		utm_source: attribution?.utmSource ?? null,
		utm_medium: attribution?.utmMedium ?? null,
		utm_campaign: attribution?.utmCampaign ?? null,
		referrer_host: attribution?.referrerHost ?? null,
		landing_path: attribution?.landingPath ?? null,
	};

	let { data: scan, error: insertError } = await supabase
		.from('scans')
		.insert(sourceScan ? { ...insertRow, source_scan_id: sourceScan.id } : insertRow)
		.select('*')
		.single();

	// supabase/scans_source_scan.sql not applied yet: the column is a nice-to-
	// have for the dashboard, never a reason to lose a sale. Retry without it.
	if (sourceScan && (insertError as { code?: string } | null)?.code === '42703') {
		console.warn('[scan/start] scans.source_scan_id missing — run supabase/scans_source_scan.sql');
		({ data: scan, error: insertError } = await supabase
			.from('scans')
			.insert(insertRow)
			.select('*')
			.single());
	}

	if (pkg === 'free' && (insertError as { code?: string } | null)?.code === '23505') {
		return freePreviewUsedResponse(await findUsedFreePreview());
	}

	if (insertError || !scan) {
		console.error('[scan/start] failed creating scan', insertError);
		throw new AppError(
			500,
			'scan_create_failed',
			'Could not create scan record. Please try again.',
		);
	}

	if (pkg !== 'free') {
		return NextResponse.json(
			{
				ok: true,
				scanId: scan.id,
				status: scan.status,
				paymentRequired: true,
				targetUrl: normalized,
				sourceScanId: sourceScan?.id ?? null,
				message: 'Complete payment to start your audit.',
			},
			{ status: 201 },
		);
	}

	// Funnel: a free scan was accepted (passed blocklist + rate limit + validation),
	// recorded before the Inngest pipeline is triggered.
	await logFunnelEvent(supabase, {
		scanId: scan.id,
		eventType: 'scan_started',
		url: normalized,
		email: email ?? null,
	});

	// NO internal alert for free scans.
	//
	// One Facebook post produced 176 scans in a week and blew through Resend's
	// 100/day limit in a single day. That limit is shared with the emails that
	// actually matter — paid report delivery, the contact form, the manual-audit
	// enquiry — so a busy day of free traffic was starving the paid path.
	//
	// Free scans are reviewed in /admin instead, which is where the follow-up
	// happens anyway. Paid scans and enquiries still alert immediately.

	await queueScanJob({
		scanId: scan.id,
		targetUrl: normalized,
		package: pkg,
		userEmail: email ?? null,
	}).catch(async (error: unknown) => {
		console.error('[scan/start] queue publish failed', {
			scanId: scan.id,
			error: error instanceof Error ? error.message : String(error),
		});
		await supabase
			.from('scans')
			.update({
				status: 'failed',
				error_message:
					'Scan could not be queued. Server background jobs are not configured.',
			})
			.eq('id', scan.id);
		throw new AppError(
			503,
			'queue_failed',
			'Could not start the scan queue. Please try again in a moment.',
		);
	});

	return NextResponse.json(
		{
			ok: true,
			scanId: scan.id,
			status: scan.status,
			message: 'Scan started successfully.',
		},
		{ status: 201 },
	);
});
