import { NextResponse } from 'next/server';
import { Resend } from 'resend';

import { AppError, asyncHandler } from '@/lib/api/error';
import { auditEnquirySchema } from '@/types/zod';

export const runtime = 'nodejs';

/** Same inbox as the contact form and the scan alerts. */
const ENQUIRY_RECIPIENT = 'contact@getqalaunch.com';

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
 * POST /api/audit-enquiry
 *
 * Someone on their own result page asking for the done-for-you manual audit.
 * This is the highest-value lead the site produces — a $299 enquiry against a
 * $9 report — so the alert is sent immediately and the enquirer's address is
 * set as reply-to, making the reply a single click.
 *
 * Body: { name, email, whatsapp?, websiteUrl?, scanId?, concern? }
 */
export const POST = asyncHandler(async (req: Request) => {
	let body: unknown;
	try {
		body = await req.json();
	} catch {
		throw new AppError(400, 'invalid_request', 'Invalid request body.');
	}

	const parsed = auditEnquirySchema.safeParse(body);
	if (!parsed.success) {
		throw new AppError(
			400,
			'invalid_request',
			'Please check the form and try again.',
			parsed.error.flatten(),
		);
	}

	const { name, email, whatsapp, websiteUrl, scanId, concern } = parsed.data;

	if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
		console.error('[audit-enquiry] RESEND_API_KEY or FROM_EMAIL not set');
		throw new AppError(
			500,
			'email_not_configured',
			'We could not send that right now. Please email contact@getqalaunch.com directly.',
		);
	}

	const resend = new Resend(process.env.RESEND_API_KEY);
	const site = websiteUrl?.trim() || 'not provided';

	const html = `<!doctype html>
<html lang="en"><body style="margin:0;padding:24px;background:#F4F8FC;font-family:'Segoe UI',Arial,Helvetica,sans-serif;">
	<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #DDE6F0;border-radius:12px;overflow:hidden;">
		<tr><td style="padding:18px 24px;background:#0E7C5E;font-size:16px;font-weight:700;color:#FFFFFF;">Manual audit enquiry — $299</td></tr>
		<tr><td style="padding:20px 12px;">
			<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
				${row('Name', name)}
				${row('Email', email)}
				${row('WhatsApp', whatsapp)}
				${row('Website', site)}
				${row('Scan ID', scanId)}
			</table>
			<div style="margin:16px 12px 0;padding-top:16px;border-top:1px solid #DDE6F0;font-size:13px;font-weight:600;color:#3B536B;">What they are worried about</div>
			<div style="margin:6px 12px 0;font-size:13px;line-height:21px;color:#18293A;white-space:pre-wrap;">${concern ? escapeHtml(concern) : '—'}</div>
			<div style="margin:18px 12px 0;padding-top:14px;border-top:1px solid #DDE6F0;font-size:12px;color:#6B7C8F;">Reply to this email to answer them directly. You promised 3 business days turnaround on the page.</div>
		</td></tr>
	</table>
</body></html>`;

	const text = [
		'Manual audit enquiry — $299',
		'',
		`Name: ${name}`,
		`Email: ${email}`,
		`WhatsApp: ${whatsapp || '—'}`,
		`Website: ${site}`,
		`Scan ID: ${scanId || '—'}`,
		'',
		'What they are worried about:',
		concern || '—',
		'',
		'Reply to this email to answer them directly.',
		'The page promises 3 business days turnaround.',
	].join('\n');

	const { error } = await resend.emails.send({
		from: `QAlaunch Audit Enquiry <${process.env.FROM_EMAIL}>`,
		to: ENQUIRY_RECIPIENT,
		replyTo: email,
		subject: `Manual audit enquiry — ${site}`,
		html,
		text,
	});

	if (error) {
		console.error('[audit-enquiry] resend send failed', error);
		throw new AppError(
			502,
			'send_failed',
			'We could not send that right now. Please email contact@getqalaunch.com directly.',
		);
	}

	console.log(
		JSON.stringify({
			ts: new Date().toISOString(),
			event: 'audit_enquiry_received',
			site,
			scanId: scanId ?? null,
		}),
	);

	return NextResponse.json({ ok: true });
});
