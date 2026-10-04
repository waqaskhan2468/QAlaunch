import { NextResponse } from 'next/server';
import { z } from 'zod';

import { AppError, asyncHandler } from '@/lib/api/error';
import { assertFormSubmitAllowed } from '@/lib/api/form-rate-limit';
import { getServiceSupabase } from '@/lib/db/supabase';
import { sendFreeResultEmailStep } from '@/lib/scan/steps/sendFreeResultEmail';

export const runtime = 'nodejs';

const notifySchema = z.object({
	scanId: z.string().trim().min(1).max(64),
	email: z
		.string()
		.trim()
		.min(1, 'Email is required.')
		.email('Enter a valid email address.')
		.max(160),
	/**
	 * Ticked box only. Asking for your own report is not agreeing to be
	 * marketed to, and in Canada and the UK that distinction is the difference
	 * between a list that can be used and one that cannot.
	 */
	consent: z.boolean().optional(),
	/** Hidden field; a person leaves it empty. */
	company: z.string().max(200).optional(),
});

/**
 * POST /api/scan/notify
 *
 * Attaches an address to a scan so its results can be emailed. Used by both
 * prompts on the result page: "email me when it's done" while the scan runs,
 * and "email me this report" once it has finished.
 *
 * Opt-in and never required. The free scan runs, and its results display, with
 * or without this — "no signup" is promised in the site metadata, in llms.txt,
 * and on the ad creatives currently running.
 *
 * If the scan has already finished the email goes out immediately. Otherwise
 * the pipeline sends it at the end, and sendFreeResultEmailStep is idempotent
 * so the two paths cannot both deliver.
 */
export const POST = asyncHandler(async (req: Request) => {
	// Shares the limit with the contact and enquiry forms, because it draws on
	// the same Resend quota.
	await assertFormSubmitAllowed(getServiceSupabase(), req, 'scan-notify');

	let body: unknown;
	try {
		body = await req.json();
	} catch {
		throw new AppError(400, 'invalid_request', 'Invalid request body.');
	}

	const parsed = notifySchema.safeParse(body);
	if (!parsed.success) {
		throw new AppError(
			400,
			'invalid_request',
			'Please enter a valid email address.',
			parsed.error.flatten(),
		);
	}

	const { scanId, email, consent, company } = parsed.data;

	// Honeypot: answer 200 so a bot cannot tell a discard from a delivery.
	if (company && company.trim()) {
		return NextResponse.json({ ok: true, status: 'queued' });
	}

	const supabase = getServiceSupabase();

	const { data: scan, error: lookupError } = await supabase
		.from('scans')
		.select('id, status, url, result_email_sent_at')
		.eq('id', scanId)
		.maybeSingle();

	if (lookupError || !scan) {
		throw new AppError(404, 'scan_not_found', 'We could not find that scan.');
	}

	const { error: updateError } = await supabase
		.from('scans')
		.update({ user_email: email, marketing_consent: consent === true })
		.eq('id', scanId);

	if (updateError) {
		console.error('[scan/notify] could not attach address', updateError.message);
		throw new AppError(
			500,
			'notify_failed',
			'We could not save that address. Please try again.',
		);
	}

	// Already finished — nothing left to wait for, so send now. A scan still
	// running gets its email from the pipeline instead.
	if (scan.status === 'done' && !scan.result_email_sent_at) {
		const result = await sendFreeResultEmailStep({
			scanId,
			targetUrl: scan.url as string,
		});
		return NextResponse.json({ ok: true, status: result.sent ? 'sent' : 'queued' });
	}

	return NextResponse.json({ ok: true, status: 'queued' });
});
