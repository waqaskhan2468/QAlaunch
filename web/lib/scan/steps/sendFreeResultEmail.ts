import { Resend } from 'resend';

import { getServiceSupabase } from '@/lib/db/supabase';
import {
	buildFreeResultEmailHtml,
	buildFreeResultEmailText,
	buildSubject,
	type ResultEmailIssue,
} from '@/lib/report/freeResultEmail';
import { computeHealthScore } from '@/lib/scoring/health';

/** How many issues to name in the email before "and N more". */
const ISSUES_IN_EMAIL = 3;

/** Most alarming first, so the three we show are the three worth showing. */
const SEVERITY_RANK: Record<string, number> = {
	critical: 0,
	high: 1,
	medium: 2,
	low: 3,
};

/**
 * Sends the free-scan result email, but only to someone who asked for it.
 *
 * Opt-in by construction: scans.user_email is only set when a visitor typed it
 * into one of the two prompts on the result page. No address, no email. The
 * scan itself is never gated on it.
 *
 * Idempotent via result_email_sent_at. Inngest retries steps, and the same
 * person can submit their address twice — once while the scan runs and again
 * when results render. Nobody should get the report twice.
 *
 * Never throws. A failed email must not fail a scan that otherwise worked;
 * the results are on the page regardless.
 */
export async function sendFreeResultEmailStep(input: {
	scanId: string;
	targetUrl: string;
}): Promise<{ sent: boolean; reason?: string }> {
	const { scanId, targetUrl } = input;

	try {
		const supabase = getServiceSupabase();

		const { data: scan, error } = await supabase
			.from('scans')
			.select('user_email, result_email_sent_at')
			.eq('id', scanId)
			.maybeSingle();

		if (error) {
			console.error('[free-result-email] scan lookup failed', error.message);
			return { sent: false, reason: 'lookup_failed' };
		}
		if (!scan?.user_email) return { sent: false, reason: 'no_address' };
		if (scan.result_email_sent_at) return { sent: false, reason: 'already_sent' };

		if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
			console.warn('[free-result-email] RESEND_API_KEY or FROM_EMAIL not set');
			return { sent: false, reason: 'not_configured' };
		}

		// Only what the free result page already shows. The email must not tease
		// findings that sit behind the paywall as though they were visible, and
		// must not invent a count — this product has shipped that mistake before.
		const { data: issueRows } = await supabase
			.from('issues')
			.select('severity, title')
			.eq('scan_id', scanId);

		const issues = (issueRows ?? []) as ResultEmailIssue[];
		const healthScore = computeHealthScore(issues.map((i) => i.severity));

		const topIssues = [...issues]
			.sort(
				(a, b) =>
					(SEVERITY_RANK[a.severity?.toLowerCase() ?? ''] ?? 9) -
					(SEVERITY_RANK[b.severity?.toLowerCase() ?? ''] ?? 9),
			)
			.slice(0, ISSUES_IN_EMAIL);

		// Both params are required: /result?scanId= alone bounces to the homepage.
		const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://getqalaunch.com';
		const resultUrl = `${base}/result?url=${encodeURIComponent(
			targetUrl,
		)}&scanId=${encodeURIComponent(scanId)}&utm_source=result_email&utm_medium=email`;

		const payload = {
			targetUrl,
			resultUrl,
			healthScore,
			issueCount: issues.length,
			topIssues,
		};

		// Claimed before sending, not after. If the send succeeds and the update
		// then fails, a retry would deliver a second copy; reserving first means
		// the worst case is a scan whose email was missed, which is recoverable
		// and invisible, rather than one that was sent twice.
		const { error: claimError } = await supabase
			.from('scans')
			.update({ result_email_sent_at: new Date().toISOString() })
			.eq('id', scanId)
			.is('result_email_sent_at', null);

		if (claimError) {
			console.error('[free-result-email] could not claim send', claimError.message);
			return { sent: false, reason: 'claim_failed' };
		}

		const resend = new Resend(process.env.RESEND_API_KEY);
		await resend.emails.send({
			from: `QAlaunch <${process.env.FROM_EMAIL}>`,
			to: scan.user_email,
			subject: buildSubject({ targetUrl, issueCount: issues.length }),
			html: buildFreeResultEmailHtml(payload),
			text: buildFreeResultEmailText(payload),
		});

		console.log(
			JSON.stringify({
				ts: new Date().toISOString(),
				event: 'free_result_email_sent',
				scanId,
				issueCount: issues.length,
			}),
		);

		return { sent: true };
	} catch (err) {
		console.error('[free-result-email] send failed — continuing', {
			scanId,
			error: err instanceof Error ? err.message : err,
		});
		return { sent: false, reason: 'send_failed' };
	}
}
