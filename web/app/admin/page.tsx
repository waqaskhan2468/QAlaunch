import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

import { ADMIN_COOKIE_NAME, verifySessionToken } from '@/lib/admin/auth';
import {
	isRangeKey,
	loadAdminAnalytics,
	RANGES,
	type RangeKey,
} from '@/lib/admin/analytics';
import { AdminLogoutButton } from '@/components/admin/admin-logout-button';
import { FollowUpComposer } from '@/components/admin/followup-composer';
import { buildFollowUpDraft } from '@/lib/admin/followup-draft';

export const metadata: Metadata = {
	title: 'Analytics',
	robots: { index: false, follow: false },
};

// Always read fresh numbers — never serve a cached dashboard.
export const dynamic = 'force-dynamic';

function fmt(n: number): string {
	return n.toLocaleString('en-US');
}

function pct(value: number | null): string {
	return value == null ? '—' : `${value.toFixed(1)}%`;
}

function money(n: number): string {
	return `$${n.toLocaleString('en-US')}`;
}

function shortDate(iso: string): string {
	return new Date(iso).toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		timeZone: 'UTC',
	});
}

function StatCard({
	label,
	value,
	sub,
	tone = 'default',
}: {
	label: string;
	value: string;
	sub?: string;
	tone?: 'default' | 'good' | 'warn';
}) {
	const valueColor =
		tone === 'good' ? 'text-accent-emerald'
		: tone === 'warn' ? 'text-danger'
		: 'text-ink';
	return (
		<div className="border-2 border-slate-deep bg-white p-5">
			<div className="text-[11px] font-bold uppercase tracking-wider text-muted-ink">
				{label}
			</div>
			<div className={`font-heading text-3xl font-black leading-none mt-2 ${valueColor}`}>
				{value}
			</div>
			{sub && <div className="mt-1.5 text-[12px] text-body">{sub}</div>}
		</div>
	);
}

function Section({
	title,
	note,
	children,
}: {
	title: string;
	note?: string;
	children: React.ReactNode;
}) {
	return (
		<section className="mt-10">
			<h2 className="font-heading text-lg font-extrabold text-ink">{title}</h2>
			{note && <p className="mt-1 text-[12.5px] text-body">{note}</p>}
			<div className="mt-3 overflow-x-auto border-2 border-slate-deep bg-white">
				{children}
			</div>
		</section>
	);
}

const TH =
	'px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-ink whitespace-nowrap';
const TD = 'px-3 py-2.5 text-[13px] text-ink whitespace-nowrap';

function Empty({ children }: { children: React.ReactNode }) {
	return <div className="px-4 py-6 text-[13px] text-body">{children}</div>;
}

export default async function AdminDashboardPage({
	searchParams,
}: {
	searchParams: Promise<{ range?: string }>;
}) {
	const cookieStore = await cookies();
	if (!verifySessionToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value)) {
		redirect('/admin/login');
	}

	const params = await searchParams;
	const range: RangeKey = isRangeKey(params.range) ? params.range : '7d';

	// This is an ops page — surface what broke instead of a stack trace.
	let data: Awaited<ReturnType<typeof loadAdminAnalytics>>;
	try {
		data = await loadAdminAnalytics(range);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error('[admin] analytics load failed', { range, error: message });
		return (
			<main className="min-h-screen bg-surface-soft px-5 py-16">
				<div className="mx-auto max-w-xl border-2 border-danger bg-white p-6">
					<h1 className="font-heading text-lg font-extrabold text-ink">
						Could not load analytics
					</h1>
					<p className="mt-2 text-[13.5px] leading-relaxed text-body">
						The dashboard signed you in, but the database query failed. This
						usually means the Supabase environment variables are missing or the
						database is unreachable.
					</p>
					<pre className="mt-4 overflow-x-auto bg-surface-soft p-3 text-[12px] text-danger">
						{message}
					</pre>
				</div>
			</main>
		);
	}

	const s = data.summary;

	return (
		<main className="min-h-screen bg-surface-soft px-5 py-10 md:px-10">
			<div className="mx-auto max-w-6xl">
				{/* Header */}
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div>
						<h1 className="font-heading text-2xl font-black tracking-tight text-ink">
							QAlaunch analytics
						</h1>
						<p className="mt-1 text-[13px] text-body">
							{data.rangeLabel} · all dates in UTC
						</p>
					</div>
					<AdminLogoutButton />
				</div>

				{/* Range filter */}
				<div className="mt-5 flex flex-wrap gap-2">
					{(Object.keys(RANGES) as RangeKey[]).map((key) => (
						<Link
							key={key}
							href={`/admin?range=${key}`}
							className={
								key === range ?
									'border-2 border-slate-deep bg-slate-deep px-3 py-1.5 text-[12.5px] font-bold text-white'
								:	'border-2 border-slate-deep bg-white px-3 py-1.5 text-[12.5px] font-bold text-ink hover:bg-surface-soft'
							}>
							{RANGES[key].label}
						</Link>
					))}
				</div>

				{data.truncated && (
					<p className="mt-4 border-l-4 border-warn bg-warn-pale px-3 py-2 text-[12.5px] font-semibold text-[#78350F]">
						Showing the most recent 5,000 scans for this range — older rows in
						this window are not included in the totals below.
					</p>
				)}

				{/* Headline stats */}
				<div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<StatCard label="Free scans" value={fmt(s.freeScans)} sub={data.rangeLabel} />
					<StatCard
						label="Paid scans"
						value={fmt(s.paidScans)}
						sub={`${money(s.revenue)} est. revenue`}
						tone="good"
					/>
					<StatCard
						label="Abandoned checkouts"
						value={fmt(s.abandonedCheckouts)}
						sub={`${money(s.abandonedRevenue)} not collected`}
						tone={s.abandonedCheckouts > 0 ? 'warn' : 'default'}
					/>
					<StatCard
						label="Free → paid"
						value={pct(s.conversionRate)}
						sub={`${fmt(s.paidScans)} paid / ${fmt(s.freeScans)} free`}
					/>
				</div>

				<div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<StatCard
						label="Checkout completion"
						value={pct(s.checkoutCompletionRate)}
						sub={`${fmt(s.paidScans)} of ${fmt(s.paidAttempts)} started`}
					/>
					<StatCard
						label="Scans completed"
						value={fmt(data.health.done)}
						sub={`${fmt(data.health.inProgress)} running`}
					/>
					<StatCard
						label="Scans failed"
						value={fmt(data.health.failed)}
						sub="in this range"
						tone={data.health.failed > 0 ? 'warn' : 'default'}
					/>
					<StatCard
						label="All-time paid"
						value={fmt(s.totalPaidAllTime)}
						sub={`${fmt(s.totalScansAllTime)} scans total`}
					/>
				</div>

				{/* Funnel */}
				<Section
					title="Conversion funnel"
					note={
						data.funnelAvailable ?
							'Unique scans reaching each step in this range.'
						:	'funnel_events table not found — run supabase/funnel_events.sql to enable this.'
					}>
					{!data.funnelAvailable ?
						<Empty>Funnel tracking is not set up on this database yet.</Empty>
					: data.funnelSteps.every((f) => f.count === 0) ?
						<Empty>No funnel events recorded in this range.</Empty>
					:	<table className="w-full">
							<thead className="border-b-2 border-slate-deep bg-surface-soft">
								<tr>
									<th className={TH}>Step</th>
									<th className={TH}>Scans</th>
									<th className={TH}>% of start</th>
									<th className={TH}>Drop from previous</th>
								</tr>
							</thead>
							<tbody>
								{data.funnelSteps.map((step) => (
									<tr key={step.key} className="border-b border-border-soft last:border-0">
										<td className={`${TD} font-semibold`}>{step.label}</td>
										<td className={TD}>{fmt(step.count)}</td>
										<td className={TD}>{pct(step.pctOfStart)}</td>
										<td className={TD}>
											{step.dropFromPrev == null ?
												'—'
											:	<span
													className={
														step.dropFromPrev > 50 ?
															'font-semibold text-danger'
														:	'text-body'
													}>
													{step.dropFromPrev.toFixed(1)}%
												</span>
											}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					}
				</Section>

				{/* Why scans fail */}
				<Section
					title="Why scans failed"
					note="Grouped by the reason shown to the visitor. Expand a row below for the raw technical cause.">
					{data.failureReasons.length === 0 ?
						<Empty>No failed scans in this range.</Empty>
					:	<table className="w-full">
							<thead className="border-b-2 border-slate-deep bg-surface-soft">
								<tr>
									<th className={TH}>Reason shown to visitor</th>
									<th className={TH}>Count</th>
								</tr>
							</thead>
							<tbody>
								{data.failureReasons.map((r) => (
									<tr key={r.reason} className="border-b border-border-soft last:border-0">
										<td className="px-3 py-2.5 text-[13px] text-ink">{r.reason}</td>
										<td className={`${TD} font-semibold`}>{fmt(r.count)}</td>
									</tr>
								))}
							</tbody>
						</table>
					}
				</Section>

				<Section
					title="Failed scans — technical detail"
					note="The raw cause behind each failure. Copy these when reporting a problem.">
					{data.failedScans.length === 0 ?
						<Empty>No failed scans in this range.</Empty>
					:	<table className="w-full">
							<thead className="border-b-2 border-slate-deep bg-surface-soft">
								<tr>
									<th className={TH}>When</th>
									<th className={TH}>Website</th>
									<th className={TH}>Reason</th>
									<th className={TH}>Technical cause</th>
								</tr>
							</thead>
							<tbody>
								{data.failedScans.map((f) => (
									<tr key={f.id} className="border-b border-border-soft last:border-0 align-top">
										<td className={TD}>{shortDate(f.createdAt)}</td>
										<td className={`${TD} font-semibold`}>{f.host}</td>
										<td className="px-3 py-2.5 text-[13px] text-ink">
											{f.reason ?? <span className="text-muted-ink">—</span>}
										</td>
										<td className="px-3 py-2.5 text-[12px] font-mono leading-relaxed text-body">
											{f.detail ?? (
												<span className="text-muted-ink">
													not captured (scan ran before failure logging)
												</span>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					}
				</Section>

				{/* Free scans to follow up — the conversion queue */}
				<Section
					title="Free scans to follow up"
					note="Completed free scans not yet emailed, most unseen issues first. The draft is written from that scan's real findings; everything stays editable.">
					{data.followUps.length === 0 ?
						<Empty>
							No free scans waiting. {data.followUpsSent > 0 &&
								`${fmt(data.followUpsSent)} already contacted in this range.`}
						</Empty>
					:	<table className="w-full">
							<thead className="border-b-2 border-slate-deep bg-surface-soft">
								<tr>
									<th className={TH}>When</th>
									<th className={TH}>Website</th>
									<th className={TH}>Issues</th>
									<th className={TH}>Unseen</th>
									<th className={TH}>Email</th>
									<th className={TH}>Action</th>
								</tr>
							</thead>
							<tbody>
								{data.followUps.map((row) => {
									const draft = buildFollowUpDraft({
										host: row.host,
										totalIssues: row.totalIssues,
										highSeverityCount: row.highSeverityCount,
										lockedTitles: row.lockedTitles,
									});
									return (
										<tr
											key={row.id}
											className="border-b border-border-soft last:border-0">
											<td className={TD}>{shortDate(row.createdAt)}</td>
											<td className={`${TD} font-semibold`}>{row.host}</td>
											<td className={TD}>
												{fmt(row.totalIssues)}
												{row.highSeverityCount > 0 && (
													<span className="ml-1 text-danger font-semibold">
														({fmt(row.highSeverityCount)} high)
													</span>
												)}
											</td>
											<td className={TD}>{fmt(row.lockedTitles.length)}</td>
											<td className={TD}>
												{row.email ?? (
													<span className="text-muted-ink">not captured</span>
												)}
											</td>
											<td className={TD}>
												<FollowUpComposer
													target={{
														id: row.id,
														host: row.host,
														email: row.email,
														totalIssues: row.totalIssues,
														highSeverityCount: row.highSeverityCount,
														draftSubject: draft.subject,
														draftBody: draft.body,
													}}
												/>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					}
				</Section>

				{/* Abandoned checkouts */}
				<Section
					title="Abandoned checkouts"
					note="Paid packages selected but never paid for — the follow-up list.">
					{data.abandonedCheckouts.length === 0 ?
						<Empty>No abandoned checkouts in this range.</Empty>
					:	<table className="w-full">
							<thead className="border-b-2 border-slate-deep bg-surface-soft">
								<tr>
									<th className={TH}>When</th>
									<th className={TH}>Website</th>
									<th className={TH}>Package</th>
									<th className={TH}>Email</th>
									<th className={TH}>Value</th>
								</tr>
							</thead>
							<tbody>
								{data.abandonedCheckouts.map((row) => (
									<tr key={row.id} className="border-b border-border-soft last:border-0">
										<td className={TD}>{shortDate(row.createdAt)}</td>
										<td className={`${TD} font-semibold`}>{row.host}</td>
										<td className={TD}>{row.pkg}</td>
										<td className={TD}>{row.email ?? '—'}</td>
										<td className={TD}>{money(row.potentialRevenue)}</td>
									</tr>
								))}
							</tbody>
						</table>
					}
				</Section>

				{/* Daily breakdown */}
				<Section title="By day">
					{data.byDay.length === 0 ?
						<Empty>No scans in this range.</Empty>
					:	<table className="w-full">
							<thead className="border-b-2 border-slate-deep bg-surface-soft">
								<tr>
									<th className={TH}>Date</th>
									<th className={TH}>Free scans</th>
									<th className={TH}>Checkouts started</th>
									<th className={TH}>Paid</th>
									<th className={TH}>Revenue</th>
								</tr>
							</thead>
							<tbody>
								{data.byDay.map((row) => (
									<tr key={row.day} className="border-b border-border-soft last:border-0">
										<td className={`${TD} font-semibold`}>{row.day}</td>
										<td className={TD}>{fmt(row.free)}</td>
										<td className={TD}>{fmt(row.paidStarted)}</td>
										<td className={TD}>{fmt(row.paid)}</td>
										<td className={TD}>{money(row.revenue)}</td>
									</tr>
								))}
							</tbody>
						</table>
					}
				</Section>

				{/* Packages */}
				<Section title="Packages sold" note="Completed payments only.">
					{data.byPackage.length === 0 ?
						<Empty>No completed payments in this range.</Empty>
					:	<table className="w-full">
							<thead className="border-b-2 border-slate-deep bg-surface-soft">
								<tr>
									<th className={TH}>Package</th>
									<th className={TH}>Sold</th>
									<th className={TH}>Est. revenue</th>
								</tr>
							</thead>
							<tbody>
								{data.byPackage.map((row) => (
									<tr key={row.pkg} className="border-b border-border-soft last:border-0">
										<td className={`${TD} font-semibold capitalize`}>{row.pkg}</td>
										<td className={TD}>{fmt(row.count)}</td>
										<td className={TD}>{money(row.revenue)}</td>
									</tr>
								))}
							</tbody>
						</table>
					}
				</Section>

				{/* Emails */}
				<Section
					title="Captured emails"
					note="People who gave an email, most valuable first (max 50).">
					{data.emails.length === 0 ?
						<Empty>No emails captured in this range.</Empty>
					:	<table className="w-full">
							<thead className="border-b-2 border-slate-deep bg-surface-soft">
								<tr>
									<th className={TH}>Email</th>
									<th className={TH}>Scans</th>
									<th className={TH}>Paid</th>
									<th className={TH}>Last seen</th>
								</tr>
							</thead>
							<tbody>
								{data.emails.map((row) => (
									<tr key={row.email} className="border-b border-border-soft last:border-0">
										<td className={`${TD} font-semibold`}>{row.email}</td>
										<td className={TD}>{fmt(row.scans)}</td>
										<td className={TD}>{fmt(row.paid)}</td>
										<td className={TD}>{shortDate(row.lastSeen)}</td>
									</tr>
								))}
							</tbody>
						</table>
					}
				</Section>

				{/* Top domains */}
				<Section title="Most scanned websites">
					{data.topDomains.length === 0 ?
						<Empty>No scans in this range.</Empty>
					:	<table className="w-full">
							<thead className="border-b-2 border-slate-deep bg-surface-soft">
								<tr>
									<th className={TH}>Website</th>
									<th className={TH}>Scans</th>
									<th className={TH}>Paid</th>
								</tr>
							</thead>
							<tbody>
								{data.topDomains.map((row) => (
									<tr key={row.host} className="border-b border-border-soft last:border-0">
										<td className={`${TD} font-semibold`}>{row.host}</td>
										<td className={TD}>{fmt(row.scans)}</td>
										<td className={TD}>{fmt(row.paid)}</td>
									</tr>
								))}
							</tbody>
						</table>
					}
				</Section>

				{/* Recent scans */}
				<Section title="Recent scans" note="Latest 50 in this range.">
					{data.recentScans.length === 0 ?
						<Empty>No scans in this range.</Empty>
					:	<table className="w-full">
							<thead className="border-b-2 border-slate-deep bg-surface-soft">
								<tr>
									<th className={TH}>When</th>
									<th className={TH}>Website</th>
									<th className={TH}>Package</th>
									<th className={TH}>Payment</th>
									<th className={TH}>Status</th>
									<th className={TH}>Email</th>
									<th className={TH}>Type</th>
								</tr>
							</thead>
							<tbody>
								{data.recentScans.map((row) => (
									<tr key={row.id} className="border-b border-border-soft last:border-0">
										<td className={TD}>{shortDate(row.createdAt)}</td>
										<td className={`${TD} font-semibold`}>{row.host}</td>
										<td className={TD}>{row.pkg}</td>
										<td className={TD}>
											<span
												className={
													row.paymentStatus === 'paid' ?
														'font-semibold text-accent-emerald'
													: row.paymentStatus === 'pending' ?
														'font-semibold text-warn'
													:	'text-body'
												}>
												{row.paymentStatus}
											</span>
										</td>
										<td className={TD}>
											<span
												className={
													row.status === 'failed' ? 'font-semibold text-danger' : 'text-body'
												}>
												{row.status}
											</span>
										</td>
										<td className={TD}>{row.email ?? '—'}</td>
										<td className={TD}>{row.websiteType ?? '—'}</td>
									</tr>
								))}
							</tbody>
						</table>
					}
				</Section>

				<p className="mt-10 text-[12px] leading-relaxed text-body">
					Revenue is estimated from list prices ($9 / $24 / $59), since the charged
					amount is not stored per scan. Site-wide visitor counts (pageviews,
					uniques, traffic sources) are not tracked in this database — those live
					in Vercel Analytics.
				</p>
			</div>
		</main>
	);
}
