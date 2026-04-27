import { NextResponse } from 'next/server';
import { normalizeUrl, urlHash, isPrivateUrl } from '@/lib/utils/url';
import { getServiceSupabase } from '@/lib/db/supabase';
import { scanStartSchema } from '@/types/zod';
import { AppError, asyncHandler } from '@/lib/api/error';

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

	const { url, package: pkg, email } = parsed.data;
	const normalized = normalizeUrl(url);

	if (isPrivateUrl(normalized)) {
		throw new AppError(
			400,
			'private_url_not_allowed',
			'Private or local URLs are not allowed. Please enter a public website URL.',
		);
	}

	const supabase = getServiceSupabase();
	const hash = urlHash(normalized);

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

	if (insertError || !scan) {
		console.error('[scan/start] failed creating scan', insertError);
		throw new AppError(
			500,
			'scan_create_failed',
			'Could not create scan record. Please try again.',
		);
	}
	// TODO: The following endpoint triggers the scan processing.
	// In the future, replace this direct call with QStash or another queue-based messaging system
	// to decouple and asynchronously handle scan processing.

	await fetch('http://localhost:3000/api/scan/process', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			scanId: scan.id,
			targetUrl: normalized,
			package: pkg,
		}),
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
