import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { timingSafeEqual, createHash } from 'node:crypto';

import { runRecoverySweep, recoveryBodyToHtml } from '@/lib/checkout/recovery';
import type { RecoveryDraft } from '@/lib/checkout/recovery-draft';

export const runtime = 'nodejs';
/** Never cached — this has side effects and must run fresh each invocation. */
export const dynamic = 'force-dynamic';

/** Replies land in the inbox the operator actually reads. */
const REPLY_TO = 'contact@getqalaunch.com';

/**
 * Length-independent constant-time compare, matching lib/admin/auth.ts:
 * timingSafeEqual throws on unequal lengths, so hash both sides first.
 */
function secretMatches(provided: string, expected: string): boolean {
	const a = createHash('sha256').update(provided).digest();
	const b = createHash('sha256').update(expected).digest();
	return timingSafeEqual(a, b);
}

/**
 * Hourly sweep that emails abandoned checkouts. Invoked by the Vercel cron
 * declared in vercel.json, which sends `Authorization: Bearer $CRON_SECRET`.
 *
 * GET because Vercel cron issues GET. The handler is safe to re-run: every
 * recipient is claimed via recovery_sent_at before its email is sent, so a
 * duplicate invocation sends nothing twice.
 */
export async function GET(req: Request) {
	const secret = process.env.CRON_SECRET;
	if (!secret) {
		return NextResponse.json(
			{ ok: false, error: 'CRON_SECRET is not configured.' },
			{ status: 503 },
		);
	}

	const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
	if (!provided || !secretMatches(provided, secret)) {
		return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
	}

	if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
		return NextResponse.json(
			{ ok: false, error: 'Email is not configured (RESEND_API_KEY / FROM_EMAIL).' },
			{ status: 503 },
		);
	}

	const resend = new Resend(process.env.RESEND_API_KEY);
	const from = `Waqas at QAlaunch <${process.env.FROM_EMAIL}>`;

	async function sendEmail(to: string, draft: RecoveryDraft) {
		const { error } = await resend.emails.send({
			from,
			to,
			replyTo: REPLY_TO,
			subject: draft.subject,
			text: draft.body,
			html: recoveryBodyToHtml(draft.body),
		});
		return { error: error ?? undefined };
	}

	try {
		const result = await runRecoverySweep({ sendEmail });
		return NextResponse.json({ ok: true, ...result });
	} catch (error) {
		console.error('[cron] recovery sweep failed', error);
		return NextResponse.json(
			{ ok: false, error: 'Recovery sweep failed. See logs.' },
			{ status: 500 },
		);
	}
}
