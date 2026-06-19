import { AppError } from '@/lib/api/error';
import type { ServiceSupabase } from '@/lib/db/supabase';
import type { ScanPackage } from '@/types/zod';

const WINDOW_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Free scans allowed per IP per rolling 24h. Tune here.
const FREE_SCANS_PER_IP_PER_DAY = 5;

type IpBucket = { count: number; resetAt: number };

const ipBuckets = new Map<string, IpBucket>();
// Separate bucket set for the free-tier daily cap (24h window, free only).
const freeIpDailyBuckets = new Map<string, IpBucket>();

function parseLimit(raw: string | undefined, fallback: number): number {
	const parsed = Number.parseInt(raw ?? '', 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getLimits() {
	return {
		perEmail: parseLimit(process.env.SCAN_START_RATE_LIMIT_PER_EMAIL_HOUR, 5),
		perIp: parseLimit(process.env.SCAN_START_RATE_LIMIT_PER_IP_HOUR, 10),
		freeGlobal: parseLimit(process.env.SCAN_START_RATE_LIMIT_FREE_GLOBAL_HOUR, 50),
	};
}

export function getClientIp(req: Request): string {
	const forwarded = req.headers.get('x-forwarded-for');
	if (forwarded) {
		const first = forwarded.split(',')[0]?.trim();
		if (first) return first;
	}
	return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/** Per-instance IP cap; complements DB-backed email/global limits on serverless. */
function assertInMemoryIpLimit(ip: string, limit: number): void {
	const now = Date.now();
	const bucket = ipBuckets.get(ip);

	if (!bucket || bucket.resetAt <= now) {
		ipBuckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
		return;
	}

	if (bucket.count >= limit) {
		throw new AppError(
			429,
			'rate_limit_exceeded',
			'Too many scan requests from your network. Please try again later.',
		);
	}

	bucket.count += 1;
}

/** Free-tier daily cap: at most N free scans per IP per rolling 24h. */
function assertFreeDailyIpLimit(ip: string, limit: number): void {
	const now = Date.now();
	const bucket = freeIpDailyBuckets.get(ip);

	if (!bucket || bucket.resetAt <= now) {
		freeIpDailyBuckets.set(ip, { count: 1, resetAt: now + DAY_MS });
		return;
	}

	if (bucket.count >= limit) {
		throw new AppError(
			429,
			'rate_limit_exceeded',
			"You've reached the free scan limit for today. Try again tomorrow, or start a paid scan.",
		);
	}

	bucket.count += 1;
}

async function countScansInWindow(
	supabase: ServiceSupabase,
	extra?: { email?: string; package?: ScanPackage },
): Promise<number> {
	const since = new Date(Date.now() - WINDOW_MS).toISOString();
	let query = supabase
		.from('scans')
		.select('*', { count: 'exact', head: true })
		.gte('created_at', since);

	if (extra?.email) {
		query = query.eq('user_email', extra.email);
	}
	if (extra?.package) {
		query = query.eq('package', extra.package);
	}

	const { count, error } = await query;

	if (error) {
		console.error('[scan/start] rate limit count failed', error);
		return 0;
	}

	return count ?? 0;
}

export async function assertScanStartAllowed(
	supabase: ServiceSupabase,
	req: Request,
	input: { email?: string; package: ScanPackage },
): Promise<void> {
	const limits = getLimits();
	const ip = getClientIp(req);

	assertInMemoryIpLimit(ip, limits.perIp);

	const emailTrim = typeof input.email === 'string' ? input.email.trim() : '';
	if (emailTrim) {
		const emailCount = await countScansInWindow(supabase, { email: emailTrim });
		if (emailCount >= limits.perEmail) {
			throw new AppError(
				429,
				'rate_limit_exceeded',
				'Too many scan requests for this email. Please try again later.',
			);
		}
	}

	if (input.package === 'free') {
		assertFreeDailyIpLimit(ip, FREE_SCANS_PER_IP_PER_DAY);

		const freeCount = await countScansInWindow(supabase, { package: 'free' });
		if (freeCount >= limits.freeGlobal) {
			throw new AppError(
				429,
				'rate_limit_exceeded',
				'Free scan capacity is temporarily full. Please try again later.',
			);
		}
	}
}
