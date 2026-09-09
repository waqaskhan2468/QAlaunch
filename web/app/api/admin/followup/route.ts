import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { Resend } from 'resend';

import { ADMIN_COOKIE_NAME, verifySessionToken } from '@/lib/admin/auth';
import { getServiceSupabase } from '@/lib/db/supabase';
import { draftBodyToHtml } from '@/lib/admin/followup-draft';

export const runtime = 'nodejs';

/** Replies come back to the inbox the operator actually reads. */
const REPLY_TO = 'contact@getqalaunch.com';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: Request) {
	const cookieStore = await cookies();
	if (!verifySessionToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value)) {
		return NextResponse.json({ ok: false, error: 'Not signed in.' }, { status: 401 });
	}

	if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
		return NextResponse.json(
			{ ok: false, error: 'Email is not configured (RESEND_API_KEY / FROM_EMAIL).' },
			{ status: 503 },
		);
	}

	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
	}

	const {
		scanId,
		to,
		subject,
		body: message,
	} = (body ?? {}) as Record<string, unknown>;

	if (
		typeof scanId !== 'string' ||
		typeof to !== 'string' ||
		typeof subject !== 'string' ||
		typeof message !== 'string'
	) {
		return NextResponse.json({ ok: false, error: 'Missing fields.' }, { status: 400 });
	}

	const recipient = to.trim();
	if (!EMAIL_RE.test(recipient)) {
		return NextResponse.json(
			{ ok: false, error: 'That does not look like a valid email address.' },
			{ status: 400 },
		);
	}
	if (!subject.trim() || !message.trim()) {
		return NextResponse.json(
			{ ok: false, error: 'Subject and message cannot be empty.' },
			{ status: 400 },
		);
	}

	const supabase = getServiceSupabase();

	// Re-check server-side: the UI hides contacted scans, but a stale tab could
	// still post one. Emailing the same person twice is the worst failure here.
	const { data: scan, error: scanError } = await supabase
		.from('scans')
		.select('id, url, followup_sent_at')
		.eq('id', scanId)
		.maybeSingle();

	if (scanError || !scan) {
		return NextResponse.json({ ok: false, error: 'Scan not found.' }, { status: 404 });
	}
	if (scan.followup_sent_at) {
		return NextResponse.json(
			{ ok: false, error: 'A follow-up was already sent for this scan.' },
			{ status: 409 },
		);
	}

	const resend = new Resend(process.env.RESEND_API_KEY);
	const { error: sendError } = await resend.emails.send({
		from: `Waqas at QAlaunch <${process.env.FROM_EMAIL}>`,
		to: recipient,
		replyTo: REPLY_TO,
		subject: subject.trim(),
		text: message,
		html: draftBodyToHtml(message),
	});

	if (sendError) {
		console.error('[admin] follow-up send failed', { scanId, error: sendError });
		return NextResponse.json(
			{ ok: false, error: 'Resend rejected the message. Check the address and try again.' },
			{ status: 502 },
		);
	}

	const { error: updateError } = await supabase
		.from('scans')
		.update({
			followup_sent_at: new Date().toISOString(),
			followup_email: recipient,
		})
		.eq('id', scanId);

	if (updateError) {
		// The email is already gone; report success but flag the bookkeeping gap
		// so the operator knows this scan may reappear as un-contacted.
		console.error('[admin] follow-up sent but not recorded', { scanId, updateError });
		return NextResponse.json({ ok: true, recorded: false });
	}

	console.log(
		JSON.stringify({
			ts: new Date().toISOString(),
			event: 'admin:followup_sent',
			scanId,
			url: scan.url,
		}),
	);

	return NextResponse.json({ ok: true, recorded: true });
}
