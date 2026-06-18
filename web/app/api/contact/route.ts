import { NextResponse } from 'next/server';
import { Resend } from 'resend';

import { AppError, asyncHandler } from '@/lib/api/error';
import { contactFormSchema } from '@/types/zod';

export const runtime = 'nodejs';

/** Inbox that should receive contact-form submissions. */
const CONTACT_RECIPIENT = 'contact@getqalaunch.com';

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function row(label: string, value: string | undefined): string {
	const display = value && value.trim() ? escapeHtml(value) : '—';
	return `<tr>
		<td style="padding:6px 12px;font-size:13px;font-weight:600;color:#3B536B;white-space:nowrap;vertical-align:top;">${label}</td>
		<td style="padding:6px 12px;font-size:13px;color:#18293A;">${display}</td>
	</tr>`;
}

/**
 * POST /api/contact
 * Validates the contact form and emails the submission to CONTACT_RECIPIENT.
 * The submitter's address is set as reply-to so a reply goes straight to them.
 *
 * Body: { firstName, lastName, email, websiteUrl?, pageCount?, websiteType?, message? }
 */
export const POST = asyncHandler(async (req: Request) => {
	let body: unknown;
	try {
		body = await req.json();
	} catch {
		throw new AppError(400, 'invalid_request', 'Invalid request body.');
	}

	const parsed = contactFormSchema.safeParse(body);
	if (!parsed.success) {
		throw new AppError(
			400,
			'invalid_request',
			'Please check the form and try again.',
			parsed.error.flatten(),
		);
	}

	const { firstName, lastName, email, websiteUrl, pageCount, websiteType, message } =
		parsed.data;

	if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
		console.error('[contact] RESEND_API_KEY or FROM_EMAIL not set');
		throw new AppError(
			500,
			'email_not_configured',
			'Messaging is temporarily unavailable. Please email us directly at contact@getqalaunch.com.',
		);
	}

	const resend = new Resend(process.env.RESEND_API_KEY);
	const fullName = `${firstName} ${lastName}`.trim();

	const html = `<!doctype html>
<html lang="en"><body style="margin:0;padding:24px;background:#F4F8FC;font-family:'Segoe UI',Arial,Helvetica,sans-serif;">
	<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #DDE6F0;border-radius:12px;overflow:hidden;">
		<tr><td style="padding:18px 24px;background:#09111F;font-size:16px;font-weight:700;color:#FFFFFF;">New contact form submission</td></tr>
		<tr><td style="padding:20px 12px;">
			<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
				${row('Name', fullName)}
				${row('Email', email)}
				${row('Website', websiteUrl)}
				${row('Pages', pageCount)}
				${row('Site type', websiteType)}
			</table>
			<div style="margin:16px 12px 0;padding-top:16px;border-top:1px solid #DDE6F0;font-size:13px;font-weight:600;color:#3B536B;">Message</div>
			<div style="margin:6px 12px 0;font-size:13px;line-height:21px;color:#18293A;white-space:pre-wrap;">${message ? escapeHtml(message) : '—'}</div>
		</td></tr>
	</table>
</body></html>`;

	const text = [
		`New contact form submission`,
		``,
		`Name: ${fullName}`,
		`Email: ${email}`,
		`Website: ${websiteUrl || '—'}`,
		`Pages: ${pageCount || '—'}`,
		`Site type: ${websiteType || '—'}`,
		``,
		`Message:`,
		message || '—',
	].join('\n');

	const { error } = await resend.emails.send({
		from: `QAlaunch Contact <${process.env.FROM_EMAIL}>`,
		to: CONTACT_RECIPIENT,
		replyTo: email,
		subject: `New contact form submission — ${fullName}`,
		html,
		text,
	});

	if (error) {
		console.error('[contact] resend send failed', error);
		throw new AppError(
			502,
			'send_failed',
			'We could not send your message right now. Please try again, or email us directly at contact@getqalaunch.com.',
		);
	}

	return NextResponse.json({ ok: true });
});
