import { Resend } from 'resend';

import type { ScanPackage } from '@/types/zod';

/** Internal inbox that receives sales/activity alerts. */
const ALERT_RECIPIENT = 'contact@getqalaunch.com';

/** Human labels for the alert subject + body. */
const PACKAGE_LABELS: Record<ScanPackage, string> = {
	free: 'Free scan',
	basic: 'Basic ($9 · 1 page)',
	standard: 'Standard ($24 · 2–5 pages)',
	premium: 'Premium ($59 · 6–10 pages)',
	enterprise: 'Enterprise (custom)',
};

function packageLabel(pkg: ScanPackage): string {
	return PACKAGE_LABELS[pkg] ?? pkg;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function row(label: string, value: string | null | undefined): string {
	const display = value && value.trim() ? escapeHtml(value) : '—';
	return `<tr>
		<td style="padding:6px 12px;font-size:13px;font-weight:600;color:#3B536B;white-space:nowrap;vertical-align:top;">${label}</td>
		<td style="padding:6px 12px;font-size:13px;color:#18293A;">${display}</td>
	</tr>`;
}

/** Result page for a scan, when the public app URL is configured. */
function resultUrl(scanId: string): string | null {
	const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
	if (!appUrl) return null;
	return `${appUrl.replace(/\/+$/, '')}/result?scanId=${encodeURIComponent(scanId)}`;
}

type AlertField = { label: string; value: string | null | undefined };

/**
 * Send one internal alert email. Never throws — these notifications must never
 * break a user-facing request or cause a webhook to be re-delivered, so every
 * failure path is logged and swallowed.
 */
async function sendAlert(input: {
	subject: string;
	heading: string;
	headingBg: string;
	fields: AlertField[];
	footerLink?: string | null;
	replyTo?: string | null;
}): Promise<void> {
	if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
		console.error(
			'[alert] RESEND_API_KEY or FROM_EMAIL not set — alert email skipped',
			{ subject: input.subject },
		);
		return;
	}

	const rows = input.fields.map((f) => row(f.label, f.value)).join('');
	const footer =
		input.footerLink ?
			`<tr><td style="padding:0 24px 20px;">
				<a href="${escapeHtml(input.footerLink)}" style="display:inline-block;padding:10px 18px;background:#16A34A;color:#FFFFFF;font-size:13px;font-weight:700;text-decoration:none;border-radius:8px;">View scan results</a>
			</td></tr>`
		:	'';

	const html = `<!doctype html>
<html lang="en"><body style="margin:0;padding:24px;background:#F4F8FC;font-family:'Segoe UI',Arial,Helvetica,sans-serif;">
	<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #DDE6F0;border-radius:12px;overflow:hidden;">
		<tr><td style="padding:18px 24px;background:${input.headingBg};font-size:16px;font-weight:700;color:#FFFFFF;">${escapeHtml(input.heading)}</td></tr>
		<tr><td style="padding:20px 12px;">
			<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
		</td></tr>
		${footer}
	</table>
</body></html>`;

	const text = [
		input.heading,
		'',
		...input.fields.map((f) => `${f.label}: ${f.value?.trim() || '—'}`),
		...(input.footerLink ? ['', `Results: ${input.footerLink}`] : []),
	].join('\n');

	try {
		const resend = new Resend(process.env.RESEND_API_KEY);
		const { error } = await resend.emails.send({
			from: `QAlaunch Alerts <${process.env.FROM_EMAIL}>`,
			to: ALERT_RECIPIENT,
			...(input.replyTo ? { replyTo: input.replyTo } : {}),
			subject: input.subject,
			html,
			text,
		});

		if (error) {
			console.error('[alert] resend send failed', {
				subject: input.subject,
				error,
			});
		}
	} catch (error) {
		console.error('[alert] unexpected send failure', {
			subject: input.subject,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

/** Someone started a free scan. */
export async function sendFreeScanAlert(input: {
	scanId: string;
	targetUrl: string;
	userEmail?: string | null;
}): Promise<void> {
	const host = (() => {
		try {
			return new URL(input.targetUrl).hostname;
		} catch {
			return input.targetUrl;
		}
	})();

	await sendAlert({
		subject: `New free scan — ${host}`,
		heading: 'New free scan started',
		headingBg: '#09111F',
		fields: [
			{ label: 'Website', value: input.targetUrl },
			{ label: 'Package', value: packageLabel('free') },
			{ label: 'Email', value: input.userEmail ?? null },
			{ label: 'Scan ID', value: input.scanId },
			{ label: 'Time (UTC)', value: new Date().toISOString() },
		],
		footerLink: resultUrl(input.scanId),
		replyTo: input.userEmail ?? null,
	});
}

/** A paid package checkout completed (Paddle transaction paid/completed). */
export async function sendPaidScanAlert(input: {
	scanId: string;
	targetUrl: string;
	userEmail?: string | null;
	pkg: ScanPackage;
	transactionId: string;
	/** Charged amount as reported by Paddle, e.g. "24.00 USD". Falls back to the plan's list price. */
	amount?: string | null;
}): Promise<void> {
	const host = (() => {
		try {
			return new URL(input.targetUrl).hostname;
		} catch {
			return input.targetUrl;
		}
	})();

	await sendAlert({
		subject: `💰 Paid scan (${input.pkg}) — ${host}`,
		heading: 'New paid scan — payment completed',
		headingBg: '#16A34A',
		fields: [
			{ label: 'Package', value: packageLabel(input.pkg) },
			{ label: 'Amount', value: input.amount ?? null },
			{ label: 'Website', value: input.targetUrl },
			{ label: 'Customer', value: input.userEmail ?? null },
			{ label: 'Scan ID', value: input.scanId },
			{ label: 'Paddle transaction', value: input.transactionId },
			{ label: 'Time (UTC)', value: new Date().toISOString() },
		],
		footerLink: resultUrl(input.scanId),
		replyTo: input.userEmail ?? null,
	});
}
