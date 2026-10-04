import { createHash } from 'node:crypto';

import { AppError } from '@/lib/api/error';
import { getClientIp } from '@/lib/api/scan-start-rate-limit';
import type { ServiceSupabase } from '@/lib/db/supabase';

/**
 * Rate limits for the two form endpoints that send mail: /api/contact and
 * /api/audit-enquiry.
 *
 * The exposure is not the content of a submission. Every value is HTML-escaped
 * before it reaches the email, so the injection payloads these forms received
 * arrived as inert text. It is the send itself: one email per POST, against a
 * Resend plan allowing 100 a day across everything the product sends, scan and
 * report mail included. A loop drains that in minutes, and afterwards real
 * enquiries fail silently, because a quota rejection looks exactly like nobody
 * getting in touch.
 *
 * Two layers, and the second is the one that matters:
 *
 * 1. In-memory, per instance. Free, and catches a naive burst that happens to
 *    land on one lambda.
 * 2. Database-backed, shared. This is the real limit.
 *
 * Layer 1 alone was the first version of this file, and it did almost nothing
 * in production: Vercel spreads consecutive requests across warm instances, so
 * four submissions in a row were handled by four lambdas that each saw their
 * own first request. Four consecutive posts to production, zero rejections.
 * Counters that are not shared are not a rate limit.
 *
 * Fails open. If the database is unreachable the submission is allowed, with
 * layer 1 still applying. A customer who cannot reach the contact form is a
 * worse outcome than a flood that gets through, and the blast radius of
 * failing open is bounded by the Resend quota rather than being unbounded.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Per source, per rolling hour. A person sends one, or two after a typo. */
const PER_IP_PER_HOUR = 3;
/** Per source, per rolling 24h. */
const PER_IP_PER_DAY = 10;
/**
 * All form mail per rolling hour, whatever the source. Absorbs a burst.
 */
const GLOBAL_PER_HOUR = 40;
/**
 * All form mail per rolling 24h, whatever the source. This is the cap that
 * actually protects the Resend quota, and the hourly one above does not
 * substitute for it: 40/hour sustained is 960 a day against a quota of 100.
 *
 * Per-source limits cannot do this job either. Anyone with a pool of addresses
 * gets the per-IP allowance multiplied by the size of the pool — demonstrated
 * by accident while testing this, when a rotating egress IP sailed past a
 * limit that was working correctly.
 *
 * 50 leaves the other half of the quota for the scan and report email that
 * shares it, and no real day comes close: these forms see a handful of
 * submissions, not fifty.
 */
const GLOBAL_PER_DAY = 50;

type Bucket = { count: number; resetAt: number };
const perIpHour = new Map<string, Bucket>();

/**
 * Salt for the stored address hash.
 *
 * A fixed fallback is fine: the goal is to avoid keeping a plain list of
 * visitor IP addresses, not to resist an attacker who already has the
 * database. Set FORM_IP_HASH_SALT to make the hashes unguessable too.
 */
const SALT = process.env.FORM_IP_HASH_SALT ?? 'qalaunch-form-rate-limit';

function hashIp(ip: string): string {
	return createHash('sha256').update(`${SALT}:${ip}`).digest('hex').slice(0, 32);
}

/** Cheap same-instance burst check. Not a substitute for the shared limit. */
function withinMemoryLimit(ip: string): boolean {
	const now = Date.now();

	for (const [key, bucket] of perIpHour) {
		if (bucket.resetAt <= now) perIpHour.delete(key);
	}

	const bucket = perIpHour.get(ip);
	if (!bucket || bucket.resetAt <= now) {
		perIpHour.set(ip, { count: 1, resetAt: now + HOUR_MS });
		return true;
	}
	if (bucket.count >= PER_IP_PER_HOUR) return false;

	bucket.count += 1;
	return true;
}

function tooMany(): never {
	// Deliberately vague about which limit was hit; a precise message tells
	// someone probing exactly how to pace themselves.
	throw new AppError(
		429,
		'rate_limit_exceeded',
		'Too many messages from your network. Please try again later, or email contact@getqalaunch.com directly.',
	);
}

/**
 * Caps how long a database call may take before we give up on it.
 *
 * Fail-open only works if the query FAILS. A Supabase client pointed at an
 * unreachable host does not reject — it hangs, and the visitor's submit button
 * spins until something upstream times out. Found by running the forms against
 * a local server with no Supabase credentials: the request never came back.
 *
 * 1.5s is far longer than a counting query against two indexes needs, and far
 * shorter than anyone will sit and wait.
 */
function withTimeout<T>(promise: PromiseLike<T>, ms: number, fallback: T): Promise<T> {
	return new Promise<T>((resolve) => {
		const timer = setTimeout(() => resolve(fallback), ms);
		Promise.resolve(promise).then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			() => {
				clearTimeout(timer);
				resolve(fallback);
			},
		);
	});
}

/** Budget for each rate-limit query. */
const DB_TIMEOUT_MS = 1_500;

async function countSince(
	supabase: ServiceSupabase,
	since: number,
	ipHash?: string,
): Promise<number | null> {
	let query = supabase
		.from('form_submissions')
		.select('*', { count: 'exact', head: true })
		.gte('created_at', new Date(since).toISOString());

	if (ipHash) query = query.eq('ip_hash', ipHash);

	const { count, error } = await query;

	if (error) {
		// Most likely cause the first time: form_submissions.sql has not been
		// applied yet. Fail open rather than take the forms down.
		console.error('[form-rate-limit] count failed, allowing submission', error.message);
		return null;
	}
	return count ?? 0;
}

/**
 * Throws 429 when this submission should not be sent, and records it when it
 * should. Call before doing any other work, so a flood costs as little as
 * possible.
 *
 * @param form which form, for after-the-fact analysis only — limits are shared
 *   across both, because the quota they can exhaust is shared.
 */
export async function assertFormSubmitAllowed(
	supabase: ServiceSupabase,
	req: Request,
	form: 'contact' | 'audit-enquiry' | 'scan-notify',
): Promise<void> {
	const ip = getClientIp(req);

	if (!withinMemoryLimit(ip)) tooMany();

	const ipHash = hashIp(ip);
	const now = Date.now();

	const [hourForIp, dayForIp, hourGlobal, dayGlobal] = await withTimeout(
		Promise.all([
			countSince(supabase, now - HOUR_MS, ipHash),
			countSince(supabase, now - DAY_MS, ipHash),
			countSince(supabase, now - HOUR_MS),
			countSince(supabase, now - DAY_MS),
		]),
		DB_TIMEOUT_MS,
		// All null: fail open, exactly as a query error does.
		[null, null, null, null],
	);

	if (
		(hourForIp !== null && hourForIp >= PER_IP_PER_HOUR) ||
		(dayForIp !== null && dayForIp >= PER_IP_PER_DAY) ||
		(hourGlobal !== null && hourGlobal >= GLOBAL_PER_HOUR) ||
		(dayGlobal !== null && dayGlobal >= GLOBAL_PER_DAY)
	) {
		tooMany();
	}

	// Recorded on acceptance rather than after a successful send, so that
	// submissions which fail downstream still count. Otherwise anyone able to
	// trigger a send failure gets unlimited attempts.
	const insertError = await withTimeout<string | null>(
		Promise.resolve(
			supabase.from('form_submissions').insert({ form, ip_hash: ipHash }),
		).then(({ error }) => error?.message ?? null),
		DB_TIMEOUT_MS,
		'insert timed out',
	);
	if (insertError) {
		console.error('[form-rate-limit] insert failed', insertError);
	}
}

/** Test-only reset for the in-memory layer. */
export function __resetFormRateLimits(): void {
	perIpHour.clear();
}

export const __limits = {
	PER_IP_PER_HOUR,
	PER_IP_PER_DAY,
	GLOBAL_PER_HOUR,
	GLOBAL_PER_DAY,
};
