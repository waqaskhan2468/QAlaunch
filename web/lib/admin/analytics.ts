import { getServiceSupabase } from '@/lib/db/supabase';
import type { ScanPackage } from '@/types/zod';

/**
 * Read-only aggregations for the /admin dashboard.
 *
 * Rows for the selected window are pulled once and aggregated in memory rather
 * than issuing a dozen count queries. Volume is low (tens of scans/day) and
 * ROW_LIMIT caps the worst case; all-time totals use head-only count queries so
 * they stay cheap regardless of table size.
 */

const ROW_LIMIT = 5000;

/** List prices used for revenue estimates — actual charges are not stored. */
const PACKAGE_PRICE: Record<string, number> = {
	free: 0,
	basic: 9,
	standard: 24,
	premium: 59,
	enterprise: 0, // custom-quoted; excluded from estimates
};

export const RANGES = {
	today: { label: 'Today', days: 0 },
	'7d': { label: 'Last 7 days', days: 7 },
	'30d': { label: 'Last 30 days', days: 30 },
	'90d': { label: 'Last 90 days', days: 90 },
	all: { label: 'All time', days: null },
} as const;

export type RangeKey = keyof typeof RANGES;

export function isRangeKey(value: string | undefined): value is RangeKey {
	return Boolean(value && value in RANGES);
}

/** Window start as an ISO string, or null for all-time. */
function rangeStart(range: RangeKey): string | null {
	if (range === 'all') return null;

	const now = new Date();
	if (range === 'today') {
		return new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
		).toISOString();
	}

	const days = RANGES[range].days ?? 7;
	return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

type ScanRow = {
	id: string;
	url: string | null;
	package: string | null;
	status: string | null;
	payment_status: string | null;
	user_email: string | null;
	website_type: string | null;
	created_at: string;
};

type FunnelRow = {
	event_type: string;
	scan_id: string;
	created_at: string;
};

function hostOf(url: string | null): string {
	if (!url) return '—';
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return url;
	}
}

function dayKey(iso: string): string {
	return iso.slice(0, 10);
}

const isPaidPackage = (pkg: string | null): boolean =>
	Boolean(pkg) && pkg !== 'free';

export type AdminAnalytics = Awaited<ReturnType<typeof loadAdminAnalytics>>;

export async function loadAdminAnalytics(range: RangeKey) {
	const supabase = getServiceSupabase();
	const start = rangeStart(range);

	// ── Window rows ────────────────────────────────────────────────────────
	let scanQuery = supabase
		.from('scans')
		.select(
			'id, url, package, status, payment_status, user_email, website_type, created_at',
		)
		.order('created_at', { ascending: false })
		.limit(ROW_LIMIT);
	if (start) scanQuery = scanQuery.gte('created_at', start);

	let funnelQuery = supabase
		.from('funnel_events')
		.select('event_type, scan_id, created_at')
		.limit(ROW_LIMIT);
	if (start) funnelQuery = funnelQuery.gte('created_at', start);

	// ── All-time totals (head-only counts, no rows transferred) ────────────
	const totalScansQuery = supabase
		.from('scans')
		.select('id', { count: 'exact', head: true });
	const totalPaidQuery = supabase
		.from('scans')
		.select('id', { count: 'exact', head: true })
		.eq('payment_status', 'paid');

	const [scansRes, funnelRes, totalScansRes, totalPaidRes] = await Promise.all([
		scanQuery,
		funnelQuery,
		totalScansQuery,
		totalPaidQuery,
	]);

	if (scansRes.error) throw new Error(`scans query failed: ${scansRes.error.message}`);

	const scans = (scansRes.data ?? []) as ScanRow[];
	// funnel_events is optional — the table may not exist on an older database.
	const funnel = (funnelRes.error ? [] : (funnelRes.data ?? [])) as FunnelRow[];

	// ── Headline numbers ───────────────────────────────────────────────────
	const freeScans = scans.filter((s) => s.package === 'free');
	const paidAttempts = scans.filter((s) => isPaidPackage(s.package));
	const paidCompleted = paidAttempts.filter((s) => s.payment_status === 'paid');
	const abandoned = paidAttempts.filter((s) => s.payment_status !== 'paid');

	const revenue = paidCompleted.reduce(
		(sum, s) => sum + (PACKAGE_PRICE[s.package ?? ''] ?? 0),
		0,
	);

	const conversionRate =
		freeScans.length > 0 ?
			(paidCompleted.length / freeScans.length) * 100
		:	null;

	const checkoutCompletionRate =
		paidAttempts.length > 0 ?
			(paidCompleted.length / paidAttempts.length) * 100
		:	null;

	// ── Per-day breakdown ──────────────────────────────────────────────────
	const byDayMap = new Map<
		string,
		{ day: string; free: number; paidStarted: number; paid: number; revenue: number }
	>();
	for (const scan of scans) {
		const day = dayKey(scan.created_at);
		const entry =
			byDayMap.get(day) ??
			{ day, free: 0, paidStarted: 0, paid: 0, revenue: 0 };

		if (scan.package === 'free') {
			entry.free += 1;
		} else if (isPaidPackage(scan.package)) {
			entry.paidStarted += 1;
			if (scan.payment_status === 'paid') {
				entry.paid += 1;
				entry.revenue += PACKAGE_PRICE[scan.package ?? ''] ?? 0;
			}
		}
		byDayMap.set(day, entry);
	}
	const byDay = [...byDayMap.values()].sort((a, b) => b.day.localeCompare(a.day));

	// ── Package split (completed payments only) ────────────────────────────
	const packageMap = new Map<string, { pkg: string; count: number; revenue: number }>();
	for (const scan of paidCompleted) {
		const pkg = scan.package ?? 'unknown';
		const entry = packageMap.get(pkg) ?? { pkg, count: 0, revenue: 0 };
		entry.count += 1;
		entry.revenue += PACKAGE_PRICE[pkg] ?? 0;
		packageMap.set(pkg, entry);
	}
	const byPackage = [...packageMap.values()].sort((a, b) => b.count - a.count);

	// ── Funnel steps ───────────────────────────────────────────────────────
	// Counted as unique scans per step, so repeat client events don't inflate.
	const stepScanIds = new Map<string, Set<string>>();
	for (const row of funnel) {
		const set = stepScanIds.get(row.event_type) ?? new Set<string>();
		set.add(row.scan_id);
		stepScanIds.set(row.event_type, set);
	}
	const FUNNEL_STEPS: Array<{ key: string; label: string }> = [
		{ key: 'scan_started', label: 'Free scan started' },
		{ key: 'scan_completed', label: 'Scan finished' },
		{ key: 'results_viewed', label: 'Results viewed' },
		{ key: 'paywall_viewed', label: 'Saw upgrade section' },
		{ key: 'checkout_started', label: 'Opened checkout' },
		{ key: 'payment_completed', label: 'Paid' },
	];
	const funnelSteps = FUNNEL_STEPS.map((step, i, arr) => {
		const count = stepScanIds.get(step.key)?.size ?? 0;
		const firstCount = stepScanIds.get(arr[0].key)?.size ?? 0;
		const prevCount = i === 0 ? count : (stepScanIds.get(arr[i - 1].key)?.size ?? 0);
		return {
			...step,
			count,
			pctOfStart: firstCount > 0 ? (count / firstCount) * 100 : null,
			dropFromPrev:
				i === 0 || prevCount === 0 ? null : ((prevCount - count) / prevCount) * 100,
		};
	});

	// ── Scan health ────────────────────────────────────────────────────────
	const health = {
		done: scans.filter((s) => s.status === 'done').length,
		failed: scans.filter((s) => s.status === 'failed').length,
		inProgress: scans.filter(
			(s) => s.status && ['pending', 'crawling', 'analyzing'].includes(s.status),
		).length,
	};

	// ── Top domains ────────────────────────────────────────────────────────
	const domainMap = new Map<string, { host: string; scans: number; paid: number }>();
	for (const scan of scans) {
		const host = hostOf(scan.url);
		const entry = domainMap.get(host) ?? { host, scans: 0, paid: 0 };
		entry.scans += 1;
		if (scan.payment_status === 'paid') entry.paid += 1;
		domainMap.set(host, entry);
	}
	const topDomains = [...domainMap.values()]
		.sort((a, b) => b.paid - a.paid || b.scans - a.scans)
		.slice(0, 15);

	// ── Captured emails (most recent activity per address) ─────────────────
	const emailMap = new Map<
		string,
		{ email: string; scans: number; paid: number; lastSeen: string }
	>();
	for (const scan of scans) {
		const email = scan.user_email?.trim();
		if (!email) continue;
		const entry =
			emailMap.get(email) ??
			{ email, scans: 0, paid: 0, lastSeen: scan.created_at };
		entry.scans += 1;
		if (scan.payment_status === 'paid') entry.paid += 1;
		if (scan.created_at > entry.lastSeen) entry.lastSeen = scan.created_at;
		emailMap.set(email, entry);
	}
	const emails = [...emailMap.values()]
		.sort((a, b) => b.paid - a.paid || b.lastSeen.localeCompare(a.lastSeen))
		.slice(0, 50);

	// ── Recent scans ───────────────────────────────────────────────────────
	const recentScans = scans.slice(0, 50).map((s) => ({
		id: s.id,
		host: hostOf(s.url),
		url: s.url ?? '—',
		pkg: (s.package ?? 'unknown') as ScanPackage | 'unknown',
		status: s.status ?? '—',
		paymentStatus: s.payment_status ?? '—',
		email: s.user_email,
		websiteType: s.website_type,
		createdAt: s.created_at,
	}));

	// Paid rows that never completed payment — the follow-up list.
	const abandonedCheckouts = abandoned.slice(0, 25).map((s) => ({
		id: s.id,
		host: hostOf(s.url),
		pkg: s.package ?? 'unknown',
		email: s.user_email,
		createdAt: s.created_at,
		potentialRevenue: PACKAGE_PRICE[s.package ?? ''] ?? 0,
	}));

	return {
		range,
		rangeLabel: RANGES[range].label,
		truncated: scans.length >= ROW_LIMIT,
		funnelAvailable: !funnelRes.error,
		summary: {
			freeScans: freeScans.length,
			paidScans: paidCompleted.length,
			paidAttempts: paidAttempts.length,
			abandonedCheckouts: abandoned.length,
			abandonedRevenue: abandoned.reduce(
				(sum, s) => sum + (PACKAGE_PRICE[s.package ?? ''] ?? 0),
				0,
			),
			revenue,
			conversionRate,
			checkoutCompletionRate,
			totalScansAllTime: totalScansRes.count ?? 0,
			totalPaidAllTime: totalPaidRes.count ?? 0,
		},
		byDay,
		byPackage,
		funnelSteps,
		health,
		topDomains,
		emails,
		recentScans,
		abandonedCheckouts,
	};
}
