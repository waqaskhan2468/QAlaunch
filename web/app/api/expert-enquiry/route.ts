import { NextResponse } from 'next/server';
import { Resend } from 'resend';

import { escapeHtml, headerSafe } from '@/lib/api/email-safety';
import { AppError, asyncHandler } from '@/lib/api/error';
import { assertFormSubmitAllowed } from '@/lib/api/form-rate-limit';
import { getClientIp } from '@/lib/api/scan-start-rate-limit';
import { getServiceSupabase } from '@/lib/db/supabase';
import { expertEnquirySchema } from '@/types/zod';

export const runtime = 'nodejs';

/** Same inbox as the contact form, the audit enquiry and the scan alerts. */
const EXPERT_RECIPIENT = 'contact@getqalaunch.com';

function row(label: string, value: string | undefined | null): string {
	const display = value && value.trim() ? escapeHtml(value) : '—';
	return `<tr>
		<td style="padding:6px 12px;font-size:13px;font-weight:600;color:#3B536B;white-space:nowrap;vertical-align:top;">${label}</td>
		<td style="padding:6px 12px;font-size:13px;color:#18293A;">${display}</td>
	</tr>`;
}

/**
 * POST /api/expert-enquiry
 *
 * Someone who just ran the PHP checker and wants a person to deal with what it
 * found. The highest-intent moment this site produces: they have been shown a
 * specific problem on their own site seconds earlier.
 *
 * The alert carries what the checker detected — PHP version and host — so the
 * reply can open with their actual situation rather than asking them to
 * explain it again. Neither field is typed by the enquirer.
 *
 * Shares the rate limiter, honeypot and header-escaping of the other two
 * forms, because it draws on the same Resend quota and the same internet.
 */
export const POST = asyncHandler(async (req: Request) => {
	await assertFormSubmitAllowed(getServiceSupabase(), req, 'expert-enquiry');

	let body: unknown;
	try {
		body = await req.json();
	} catch {
		throw new AppError(400, 'invalid_request', 'Invalid request body.');
	}

	const parsed = expertEnquirySchema.safeParse(body);
	if (!parsed.success) {
		throw new AppError(
			400,
			'invalid_request',
			'Please check the form and try again.',
			parsed.error.flatten(),
		);
	}

	// Honeypot: answer 200 so a bot cannot tell a discard from a delivery.
	if (parsed.data.company && parsed.data.company.trim()) {
		console.log(
			JSON.stringify({
				ts: new Date().toISOString(),
				event: 'expert_enquiry_honeypot',
				ip: getClientIp(req),
			}),
		);
		return NextResponse.json({ ok: true });
	}

	const { name, email, websiteUrl, need, detectedPhp, detectedHost } = parsed.data;

	if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
		console.error('[expert-enquiry] RESEND_API_KEY or FROM_EMAIL not set');
		throw new AppError(
			500,
			'email_not_configured',
			`We could not send that right now. Please email ${EXPERT_RECIPIENT} directly.`,
		);
	}

	const resend = new Resend(process.env.RESEND_API_KEY);

	const html = `<!doctype html>
<html lang="en"><body style="margin:0;padding:24px;background:#F4F8FC;font-family:'Segoe UI',Arial,Helvetica,sans-serif;">
	<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #DDE6F0;border-radius:12px;overflow:hidden;">
		<tr><td style="padding:18px 24px;background:#1847A8;font-size:16px;font-weight:700;color:#FFFFFF;">Wants an expert to update their site</td></tr>
		<tr><td style="padding:20px 12px;">
			<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
				${row('Name', name)}
				${row('Email', email)}
				${row('Website', websiteUrl)}
			</table>

			<div style="margin:16px 12px 0;padding-top:16px;border-top:1px solid #DDE6F0;font-size:13px;font-weight:600;color:#3B536B;">What they said they need</div>
			<div style="margin:6px 12px 0;font-size:13px;line-height:21px;color:#18293A;white-space:pre-wrap;">${need ? escapeHtml(need) : '— (not filled in)'}</div>

			<div style="margin:18px 12px 0;padding-top:16px;border-top:1px solid #DDE6F0;font-size:13px;font-weight:600;color:#3B536B;">What our check found on their site</div>
			<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:4px;">
				${row('PHP reported', detectedPhp)}
				${row('Hosting', detectedHost)}
			</table>
			<div style="margin:10px 12px 0;font-size:12px;line-height:18px;color:#6B7C8F;">
				Read from one request to their homepage, seconds before they sent this.
				A PHP version here is the banner their server printed — hosts often patch
				without changing it, so treat it as a conversation starter, not a diagnosis.
			</div>

			<div style="margin:18px 12px 0;padding-top:14px;border-top:1px solid #DDE6F0;font-size:12px;color:#6B7C8F;">Reply to this email to answer them directly.</div>
		</td></tr>
	</table>
</body></html>`;

	const text = [
		'Wants an expert to update their site',
		'',
		`Name: ${name}`,
		`Email: ${email}`,
		`Website: ${websiteUrl}`,
		'',
		'What they said they need:',
		need || '— (not filled in)',
		'',
		'What our check found:',
		`  PHP reported: ${detectedPhp || '—'}`,
		`  Hosting: ${detectedHost || '—'}`,
		'',
		'Read from one request to their homepage. A PHP version here is the banner',
		'their server printed; hosts often patch without changing it.',
		'',
		'Reply to this email to answer them directly.',
	].join('\n');

	const { error } = await resend.emails.send({
		from: `QAlaunch Expert Enquiry <${process.env.FROM_EMAIL}>`,
		to: EXPERT_RECIPIENT,
		replyTo: email,
		subject: headerSafe(`Expert help wanted — ${websiteUrl}`),
		html,
		text,
	});

	if (error) {
		console.error('[expert-enquiry] resend send failed', error);
		throw new AppError(
			502,
			'send_failed',
			`We could not send that right now. Please email ${EXPERT_RECIPIENT} directly.`,
		);
	}

	console.log(
		JSON.stringify({
			ts: new Date().toISOString(),
			event: 'expert_enquiry_received',
			website: websiteUrl,
			detectedPhp: detectedPhp ?? null,
			detectedHost: detectedHost ?? null,
		}),
	);

	return NextResponse.json({ ok: true });
});
