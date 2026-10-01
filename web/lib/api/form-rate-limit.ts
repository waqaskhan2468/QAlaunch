import { AppError } from '@/lib/api/error';
import { getClientIp } from '@/lib/api/scan-start-rate-limit';

/**
 * Rate limits for the two form endpoints that send mail: /api/contact and
 * /api/audit-enquiry.
 *
 * The real exposure is not the content of a submission — every value is
 * HTML-escaped before it reaches the email, so injection payloads arrive as
 * inert text. It is the send itself. Both routes called Resend once per POST
 * with nothing standing in the way, and the Resend plan allows 100 emails a
 * day across every message the product sends. Anyone could loop a POST and
 * exhaust that quota in a couple of minutes, after which real enquiries stop
 * arriving and nobody finds out, because a quota rejection looks like silence.
 * That is a denial of service on the sales inbox, which matters more here than
 * any of the payloads in those test submissions did.
 *
 * Limits are deliberately tight. These forms produce a handful of submissions
 * a day; a genuine person sends one, occasionally two if they mistype an
 * address. Shared office or carrier-NAT addresses could in principle collide,
 * and at this volume that trade is worth making.
 *
 * Per-instance, in-memory, matching assertScanStartAllowed. On serverless this
 * is approximate: each warm instance keeps its own counters, so a determined
 * attacker spread across instances gets a higher effective ceiling than the
 * numbers below suggest. It still turns a trivial one-line flood into
 * something that has to be worked at, and the global cap bounds the damage per
 * instance. A durable version would need a DB round trip per submission, which
 * is not worth it until these forms carry real volume.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Per IP, per rolling hour. */
const PER_IP_PER_HOUR = 3;
/** Per IP, per rolling 24h. */
const PER_IP_PER_DAY = 10;
/**
 * All form mail per instance per hour, whatever the source address.
 * Sized well under the 100/day Resend quota so a distributed flood still
 * cannot starve the scan and report emails that share it.
 */
const GLOBAL_PER_HOUR = 40;

type Bucket = { count: number; resetAt: number };

const perIpHour = new Map<string, Bucket>();
const perIpDay = new Map<string, Bucket>();
const globalHour: Bucket = { count: 0, resetAt: Date.now() + HOUR_MS };

/**
 * Counts one hit against a bucket.
 * @returns true when the caller is within the limit, false when it is over.
 */
function hit(store: Map<string, Bucket>, key: string, limit: number, windowMs: number): boolean {
	const now = Date.now();
	const bucket = store.get(key);

	if (!bucket || bucket.resetAt <= now) {
		store.set(key, { count: 1, resetAt: now + windowMs });
		return true;
	}

	if (bucket.count >= limit) return false;

	bucket.count += 1;
	return true;
}

/**
 * Drops buckets that expired a while ago.
 *
 * Without this the maps grow once per distinct address for the lifetime of the
 * instance, which is exactly what a flood produces. Called on each request;
 * cheap at this volume.
 */
function sweep(store: Map<string, Bucket>): void {
	const now = Date.now();
	for (const [key, bucket] of store) {
		if (bucket.resetAt <= now) store.delete(key);
	}
}

/**
 * Throws 429 when this submission should not be sent.
 *
 * The message is deliberately vague about which limit was reached — a precise
 * one tells someone probing exactly how to pace themselves.
 */
export function assertFormSubmitAllowed(req: Request): void {
	const ip = getClientIp(req);
	const now = Date.now();

	sweep(perIpHour);
	sweep(perIpDay);

	if (globalHour.resetAt <= now) {
		globalHour.count = 0;
		globalHour.resetAt = now + HOUR_MS;
	}

	const tooMany =
		!hit(perIpHour, ip, PER_IP_PER_HOUR, HOUR_MS) ||
		!hit(perIpDay, ip, PER_IP_PER_DAY, DAY_MS) ||
		globalHour.count >= GLOBAL_PER_HOUR;

	if (tooMany) {
		throw new AppError(
			429,
			'rate_limit_exceeded',
			'Too many messages from your network. Please try again later, or email contact@getqalaunch.com directly.',
		);
	}

	globalHour.count += 1;
}

/** Test-only reset, so one test's counters cannot leak into the next. */
export function __resetFormRateLimits(): void {
	perIpHour.clear();
	perIpDay.clear();
	globalHour.count = 0;
	globalHour.resetAt = Date.now() + HOUR_MS;
}
