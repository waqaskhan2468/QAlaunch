/**
 * Abandoned-checkout recovery.
 *
 * A scan row carrying a paid package with payment_status still 'pending' is
 * someone who entered an email, chose a package, and stopped at payment. They
 * have already seen real issues on their own site, so this is the highest-intent
 * unconverted visitor in the funnel — and nothing was sent to them before this.
 *
 * Selection is deliberately conservative, because the sending domain also
 * delivers paid reports and a spam complaint there costs more than a $9 sale:
 *
 *  - one email per checkout, ever (recovery_sent_at gates it)
 *  - nothing younger than MIN_AGE — they may still be mid-payment
 *  - nothing older than MAX_AGE — a month-old checkout is a cold stranger
 *  - a hard per-run cap, so a backlog drains over days instead of bursting
 */

import { getServiceSupabase } from '@/lib/db/supabase';
import {
	buildRecoveryDraft,
	recoveryBodyToHtml,
	type RecoveryDraft,
} from '@/lib/checkout/recovery-draft';

/** Packages that can be recovered. 'enterprise' is custom-quoted, so it is excluded. */
const RECOVERABLE_PACKAGES = new Set(['basic', 'standard', 'premium']);

/** Leave them alone this long — they may simply still be on the Paddle page. */
export const MIN_AGE_MS = 60 * 60 * 1000; // 1 hour
/** Past this, an unsolicited nudge reads as cold email rather than a reminder. */
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
/** Per-run ceiling. Low volume by design — a burst is what gets domains flagged. */
export const MAX_PER_RUN = 25;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type RecoveryCandidateRow = {
	id: string;
	url: string | null;
	package: string | null;
	payment_status: string | null;
	user_email: string | null;
	created_at: string;
	recovery_sent_at: string | null;
};

export type RecoveryCandidate = {
	scanId: string;
	host: string;
	pkg: string;
	email: string;
};

/** Bare hostname for display; falls back to the raw string when unparseable. */
export function hostOf(url: string | null): string {
	if (!url) return 'your site';
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return url.replace(/^https?:\/\//, '').split('/')[0] || 'your site';
	}
}

/**
 * Pure selection step: which rows deserve a recovery email right now.
 * Kept free of IO so the rules above are directly testable.
 */
export function selectRecoverable(
	rows: RecoveryCandidateRow[],
	now: number = Date.now(),
): RecoveryCandidate[] {
	const picked: RecoveryCandidate[] = [];

	for (const row of rows) {
		if (row.recovery_sent_at) continue;
		if (row.payment_status === 'paid') continue;
		if (!row.package || !RECOVERABLE_PACKAGES.has(row.package)) continue;

		const email = row.user_email?.trim() ?? '';
		if (!EMAIL_RE.test(email)) continue;

		const created = Date.parse(row.created_at);
		if (Number.isNaN(created)) continue;

		const age = now - created;
		if (age < MIN_AGE_MS || age > MAX_AGE_MS) continue;

		picked.push({
			scanId: row.id,
			host: hostOf(row.url),
			pkg: row.package,
			email,
		});

		if (picked.length >= MAX_PER_RUN) break;
	}

	return picked;
}

export type RecoverySweepResult = {
	considered: number;
	selected: number;
	sent: number;
	failed: number;
	skipped: string | null;
};

/**
 * Find abandoned checkouts and send each one its single recovery email.
 *
 * Disabled unless CHECKOUT_RECOVERY_ENABLED is exactly 'true'. This mails real
 * customers, so it stays off until the operator turns it on deliberately.
 */
export async function runRecoverySweep(
	deps: {
		sendEmail: (to: string, draft: RecoveryDraft) => Promise<{ error?: unknown }>;
		now?: number;
	},
): Promise<RecoverySweepResult> {
	const empty: RecoverySweepResult = {
		considered: 0,
		selected: 0,
		sent: 0,
		failed: 0,
		skipped: null,
	};

	if (process.env.CHECKOUT_RECOVERY_ENABLED !== 'true') {
		return { ...empty, skipped: 'CHECKOUT_RECOVERY_ENABLED is not "true"' };
	}

	const now = deps.now ?? Date.now();
	const supabase = getServiceSupabase();

	// Widen the window slightly past MAX_AGE so the pure filter — not the query —
	// owns the age rules, keeping them in one place and under test.
	const since = new Date(now - MAX_AGE_MS - 60_000).toISOString();

	const { data, error } = await supabase
		.from('scans')
		.select('id, url, package, payment_status, user_email, created_at, recovery_sent_at')
		.neq('package', 'free')
		.neq('payment_status', 'paid')
		.is('recovery_sent_at', null)
		.gte('created_at', since)
		.order('created_at', { ascending: true })
		.limit(200);

	if (error) throw new Error(`recovery query failed: ${error.message}`);

	const rows = (data ?? []) as RecoveryCandidateRow[];
	const candidates = selectRecoverable(rows, now);

	let sent = 0;
	let failed = 0;

	for (const candidate of candidates) {
		const draft = buildRecoveryDraft({
			host: candidate.host,
			pkg: candidate.pkg,
			scanId: candidate.scanId,
		});

		// Claim the row BEFORE sending. If the send then fails we lose one
		// recovery attempt; if we sent first and the write failed, an overlapping
		// run could email the same person twice. Silence is the cheaper mistake.
		const { error: claimError } = await supabase
			.from('scans')
			.update({
				recovery_sent_at: new Date(now).toISOString(),
				recovery_email: candidate.email,
			})
			.eq('id', candidate.scanId)
			.is('recovery_sent_at', null);

		if (claimError) {
			failed += 1;
			console.error('[recovery] could not claim row', {
				scanId: candidate.scanId,
				error: claimError.message,
			});
			continue;
		}

		const { error: sendError } = await deps.sendEmail(candidate.email, draft);
		if (sendError) {
			failed += 1;
			console.error('[recovery] send failed', { scanId: candidate.scanId, error: sendError });
			continue;
		}

		sent += 1;
		console.log(
			JSON.stringify({
				ts: new Date(now).toISOString(),
				event: 'checkout:recovery_sent',
				scanId: candidate.scanId,
				host: candidate.host,
				pkg: candidate.pkg,
			}),
		);
	}

	return {
		considered: rows.length,
		selected: candidates.length,
		sent,
		failed,
		skipped: null,
	};
}

export { recoveryBodyToHtml };
