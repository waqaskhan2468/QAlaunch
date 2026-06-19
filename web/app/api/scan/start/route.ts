import { NextResponse } from 'next/server';
import { normalizeUrl, urlHash, isPrivateUrl } from '@/lib/utils/url';
import { getServiceSupabase } from '@/lib/db/supabase';
import { scanStartSchema } from '@/types/zod';
import { AppError, asyncHandler } from '@/lib/api/error';
import { assertScanStartAllowed } from '@/lib/api/scan-start-rate-limit';
import { queueScanJob } from '@/lib/api/queue-scan-job';
import { validateScanTarget } from '@/lib/scan/validate-target';
import { isBlockedDomain } from '@/lib/scan/blocklist';
import { logFunnelEvent } from '@/lib/analytics/funnel';

export const runtime = 'nodejs';

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

	const { url, package: pkg, email, acknowledgePublicOnly } = parsed.data;
	const normalized = normalizeUrl(url);

	if (isPrivateUrl(normalized)) {
		throw new AppError(
			400,
			'private_url_not_allowed',
			'Private or local URLs are not allowed. Please enter a public website URL.',
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
	if (pkg !== 'free') {
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

	if (pkg === 'free') {
		const { data: existing, error: freeCheckError } = await supabase
			.from('scans')
			.select('id')
			.eq('url_hash', hash)
			.eq('package', 'free')
			.eq('free_preview_used', true)
			.limit(1);

		if (freeCheckError) {
			console.error('[scan/start] free preview check failed', freeCheckError);
			throw new AppError(
				500,
				'free_check_failed',
				'Unable to validate free plan eligibility right now.',
			);
		}

		if (existing?.length) {
			return NextResponse.json(
				{
					ok: false,
					code: 'free_preview_used',
					message:
						'You have already used your free preview for this website. To continue, please select a paid package.',
				},
				{ status: 409 },
			);
		}
	}

	const { data: scan, error: insertError } = await supabase
		.from('scans')
		.insert({
			url: normalized,
			url_hash: hash,
			package: pkg,
			status: 'pending',
			user_email: email ?? null,
			payment_status: pkg === 'free' ? 'free' : 'pending',
			free_preview_used: false,
		})
		.select('*')
		.single();

	if (pkg === 'free' && (insertError as { code?: string } | null)?.code === '23505') {
		return NextResponse.json(
			{
				ok: false,
				code: 'free_preview_used',
				message:
					'You have already used your free preview for this website. To continue, please select a paid package.',
			},
			{ status: 409 },
		);
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
