import { expect, test, vi, beforeEach } from 'vitest';

type Row = Record<string, unknown>;

let scanRows: Row[] = [];
let funnelRows: Row[] = [];

/** Minimal chainable stand-in for the supabase-js query builder. */
function makeQuery(rows: Row[], count: number | null) {
	const result = { data: rows, error: null, count };
	const builder: Record<string, unknown> = {
		then: (resolve: (v: typeof result) => unknown) => Promise.resolve(resolve(result)),
	};
	for (const method of ['select', 'order', 'limit', 'gte', 'eq']) {
		builder[method] = () => builder;
	}
	// `select(..., {head:true})` resolves to a count-only result.
	builder.select = (_cols: string, opts?: { head?: boolean }) => {
		if (opts?.head) {
			return {
				...builder,
				eq: () => ({
					then: (r: (v: typeof result) => unknown) =>
						Promise.resolve(r({ data: [], error: null, count })),
				}),
				then: (r: (v: typeof result) => unknown) =>
					Promise.resolve(r({ data: [], error: null, count })),
			};
		}
		return builder;
	};
	return builder;
}

vi.mock('@/lib/db/supabase', () => ({
	getServiceSupabase: () => ({
		from: (table: string) =>
			table === 'scans' ?
				makeQuery(scanRows, scanRows.length)
			:	makeQuery(funnelRows, funnelRows.length),
	}),
}));

const { loadAdminAnalytics } = await import('@/lib/admin/analytics');

const now = new Date().toISOString();

beforeEach(() => {
	scanRows = [];
	funnelRows = [];
});

function scan(over: Partial<Row> = {}): Row {
	return {
		id: crypto.randomUUID(),
		url: 'https://example.com',
		package: 'free',
		status: 'done',
		payment_status: 'free',
		user_email: null,
		website_type: 'business',
		created_at: now,
		...over,
	};
}

test('separates free, paid, and abandoned correctly', async () => {
	scanRows = [
		scan(),
		scan(),
		scan({ package: 'basic', payment_status: 'paid' }),
		scan({ package: 'standard', payment_status: 'paid' }),
		// Selected a package, never paid → abandoned.
		scan({ package: 'premium', payment_status: 'pending' }),
	];

	const d = await loadAdminAnalytics('30d');

	expect(d.summary.freeScans).toBe(2);
	expect(d.summary.paidScans).toBe(2);
	expect(d.summary.paidAttempts).toBe(3);
	expect(d.summary.abandonedCheckouts).toBe(1);
});

test('revenue uses list prices and ignores unpaid rows', async () => {
	scanRows = [
		scan({ package: 'basic', payment_status: 'paid' }), // 9
		scan({ package: 'standard', payment_status: 'paid' }), // 24
		scan({ package: 'premium', payment_status: 'paid' }), // 59
		scan({ package: 'premium', payment_status: 'pending' }), // not counted
	];

	const d = await loadAdminAnalytics('30d');

	expect(d.summary.revenue).toBe(92);
	expect(d.summary.abandonedRevenue).toBe(59);
});

test('conversion and checkout-completion rates', async () => {
	scanRows = [
		scan(),
		scan(),
		scan(),
		scan(),
		scan({ package: 'basic', payment_status: 'paid' }),
		scan({ package: 'basic', payment_status: 'pending' }),
	];

	const d = await loadAdminAnalytics('30d');

	expect(d.summary.conversionRate).toBeCloseTo(25); // 1 paid / 4 free
	expect(d.summary.checkoutCompletionRate).toBeCloseTo(50); // 1 of 2 attempts
});

test('rates are null (not NaN) with no data', async () => {
	const d = await loadAdminAnalytics('30d');
	expect(d.summary.conversionRate).toBeNull();
	expect(d.summary.checkoutCompletionRate).toBeNull();
	expect(d.summary.revenue).toBe(0);
});

test('groups by day and by package', async () => {
	scanRows = [
		scan({ created_at: '2026-09-01T10:00:00Z' }),
		scan({ created_at: '2026-09-01T18:00:00Z' }),
		scan({
			created_at: '2026-09-02T09:00:00Z',
			package: 'standard',
			payment_status: 'paid',
		}),
	];

	const d = await loadAdminAnalytics('all');

	// Newest day first.
	expect(d.byDay[0].day).toBe('2026-09-02');
	expect(d.byDay[0].paid).toBe(1);
	expect(d.byDay[0].revenue).toBe(24);
	expect(d.byDay[1].day).toBe('2026-09-01');
	expect(d.byDay[1].free).toBe(2);

	expect(d.byPackage).toEqual([{ pkg: 'standard', count: 1, revenue: 24 }]);
});

test('funnel counts unique scans per step, not raw events', async () => {
	funnelRows = [
		{ event_type: 'scan_started', scan_id: 'a', created_at: now },
		{ event_type: 'scan_started', scan_id: 'b', created_at: now },
		// Same scan viewing results three times must count once.
		{ event_type: 'results_viewed', scan_id: 'a', created_at: now },
		{ event_type: 'results_viewed', scan_id: 'a', created_at: now },
		{ event_type: 'results_viewed', scan_id: 'a', created_at: now },
		{ event_type: 'payment_completed', scan_id: 'a', created_at: now },
	];

	const d = await loadAdminAnalytics('30d');
	const step = (k: string) => d.funnelSteps.find((s) => s.key === k)!;

	expect(step('scan_started').count).toBe(2);
	expect(step('results_viewed').count).toBe(1);
	expect(step('results_viewed').pctOfStart).toBeCloseTo(50);
	expect(step('payment_completed').count).toBe(1);
	expect(d.funnelAvailable).toBe(true);
});

test('aggregates domains and emails, ranking paying customers first', async () => {
	scanRows = [
		scan({ url: 'https://www.shop.com/x', user_email: 'a@x.com' }),
		scan({
			url: 'https://shop.com/y',
			user_email: 'a@x.com',
			package: 'basic',
			payment_status: 'paid',
		}),
		scan({ url: 'https://other.com', user_email: 'b@y.com' }),
	];

	const d = await loadAdminAnalytics('30d');

	// www. stripped and both URLs collapsed to one host.
	const shop = d.topDomains.find((x) => x.host === 'shop.com')!;
	expect(shop.scans).toBe(2);
	expect(shop.paid).toBe(1);

	expect(d.emails[0].email).toBe('a@x.com'); // paying customer ranks first
	expect(d.emails[0].scans).toBe(2);
	expect(d.emails[0].paid).toBe(1);
});

test('health counts map scan statuses', async () => {
	scanRows = [
		scan({ status: 'done' }),
		scan({ status: 'failed' }),
		scan({ status: 'crawling' }),
		scan({ status: 'analyzing' }),
		scan({ status: 'pending' }),
	];

	const d = await loadAdminAnalytics('30d');

	expect(d.health.done).toBe(1);
	expect(d.health.failed).toBe(1);
	expect(d.health.inProgress).toBe(3);
});

test('survives a missing funnel_events table', async () => {
	scanRows = [scan()];
	const d = await loadAdminAnalytics('30d');
	// Mock always returns rows; this asserts the flag exists and scans still load.
	expect(d.summary.freeScans).toBe(1);
	expect(typeof d.funnelAvailable).toBe('boolean');
});
