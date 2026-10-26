'use client';

import Link from 'next/link';
import { Download, Lock } from 'lucide-react';

import { cn } from '@/lib/utils';
import { CATEGORY_LABEL, FindingCard, type ScanIssue } from '@/components/audit/finding-card';
import { formatPackagePrice } from '@/components/pricing/pricing-plans';

/**
 * The paid report, on the web.
 *
 * Until now a paying customer got a PDF and nothing else: /result redirected a
 * paid scan to the order page, whose "View full results" button linked back to
 * /result. This is the same content as the PDF — every issue, its evidence
 * and its fix — at a link that can be sent to a developer, plus the PDF
 * download. The public sample report renders the same component.
 */

export type ReportPage = {
	page_url: string;
	page_role?: string | null;
	screenshot_desktop_url?: string | null;
	screenshot_mobile_url?: string | null;
};

export type FullReportScan = {
	id: string;
	url: string | null;
	package: string | null;
	created_at?: string | null;
	report_ready: boolean;
};

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const CATEGORY_ORDER = [
	'functionality',
	'ui_bugs',
	'usability_ux',
	'responsiveness',
	'performance',
	'seo',
	'accessibility',
	'security',
	'content',
];

function hostOf(url: string | null): string {
	if (!url) return 'your site';
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return url;
	}
}

function pathOf(url: string): string {
	try {
		const u = new URL(url);
		return u.pathname === '/' ? 'Homepage' : u.pathname;
	} catch {
		return url;
	}
}

function scoreTone(score: number): { ring: string; label: string } {
	if (score >= 80) return { ring: '#22C55E', label: 'Good' };
	if (score >= 60) return { ring: '#D97706', label: 'Needs attention' };
	return { ring: '#DC2626', label: 'Critical issues' };
}

export function FullReportView({
	scan,
	issues,
	pages,
	healthScore,
	mode,
	scanPageIdToUrl,
}: {
	scan: FullReportScan;
	issues: ScanIssue[];
	pages: ReportPage[];
	healthScore: number;
	/** `sample` adds the "this is what you get" framing and a buy CTA. */
	mode: 'paid' | 'sample';
	/** issue.scan_page_id → page URL, for the per-page label on multi-page reports. */
	scanPageIdToUrl?: Record<string, string>;
}) {
	const host = hostOf(scan.url);
	const bugs = issues.filter((i) => i.finding_type !== 'suggestion');
	const sorted = [...issues].sort(
		(a, b) =>
			(SEVERITY_ORDER[a.severity.toLowerCase()] ?? 9) -
			(SEVERITY_ORDER[b.severity.toLowerCase()] ?? 9),
	);
	const severityCounts = bugs.reduce<Record<string, number>>((acc, i) => {
		const k = i.severity.toLowerCase();
		acc[k] = (acc[k] ?? 0) + 1;
		return acc;
	}, {});
	const byCategory = CATEGORY_ORDER.map((key) => ({
		key,
		label: CATEGORY_LABEL[key] ?? key,
		items: sorted.filter((i) => i.category === key),
	})).filter((c) => c.items.length > 0);
	const tone = scoreTone(healthScore);
	const multiPage = pages.length > 1;
	const withEvidence = issues.filter((i) => i.screenshot_url?.includes('/crop-')).length;

	return (
		<div className='bg-surface-soft'>
			{mode === 'sample' ? (
				<div className='border-b border-brand/20 bg-brand-pale px-5 py-3 text-center text-sm font-medium text-brand md:px-10'>
					This is a real report from a real scan of a public demo store, shown in full so you
					can see exactly what a paid report contains before you buy one.
				</div>
			) : null}

			{/* ── Header ─────────────────────────────────────────────────── */}
			<section
				className='relative overflow-hidden px-5 pb-12 pt-12 md:px-10'
				style={{ background: 'linear-gradient(180deg, #0F172A 0%, #1E293B 100%)' }}>
				<div className='relative z-10 mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-[1fr_300px]'>
					<div>
						<div className='mb-4 flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-widest text-white/50'>
							<span className='block size-2 rounded-full' style={{ background: '#22C55E' }} />
							<span>{mode === 'sample' ? 'Sample report' : 'Full report'}</span>
							<span>·</span>
							<span>
								{pages.length} {pages.length === 1 ? 'page' : 'pages'} tested
							</span>
						</div>
						<h1
							className='font-heading font-black leading-[1.05] tracking-tight text-white'
							style={{ fontSize: 'clamp(28px, 4vw, 44px)', letterSpacing: '-1px' }}>
							<span className='font-mono text-white/80'>{host}</span>
							<br />
							<span style={{ color: '#FCA5A5' }}>{bugs.length}</span> issues found
						</h1>
						<p className='mt-4 max-w-xl text-[15px] leading-relaxed text-white/65'>
							Every issue below includes what we saw, why it matters and how to fix it.
							{withEvidence > 0 ?
								` ${withEvidence} ${withEvidence === 1 ? 'issue carries' : 'issues carry'} a screenshot taken on the page.`
							:	''}
						</p>
						<div className='mt-6 flex flex-wrap gap-2.5'>
							{(['critical', 'high', 'medium', 'low'] as const)
								.filter((k) => (severityCounts[k] ?? 0) > 0)
								.map((k) => (
									<div
										key={k}
										className='inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-2 font-mono text-[12px] font-semibold text-white/80'>
										<span className='font-heading text-[14px] font-black'>{severityCounts[k]}</span>
										{k.charAt(0).toUpperCase() + k.slice(1)}
									</div>
								))}
						</div>
						<div className='mt-7 flex flex-wrap items-center gap-3'>
							{scan.report_ready ? (
								<a
									href={`/api/scan/report-url?scanId=${encodeURIComponent(scan.id)}`}
									target='_blank'
									rel='noopener noreferrer'
									className='inline-flex items-center gap-2 rounded-xl bg-accent-bright px-5 py-3 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:shadow-lg'>
									<Download className='size-4' strokeWidth={2.5} />
									Download the PDF
								</a>
							) : null}
							{mode === 'sample' ? (
								<Link
									href='/#audit-input'
									className='inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10'>
									Scan my own site free →
								</Link>
							) : null}
						</div>
					</div>

					<div
						className='flex flex-col items-center rounded-2xl p-7 text-center'
						style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
						<div className='mb-3 font-mono text-[11px] uppercase tracking-[2.5px] text-white/40'>
							Health score
						</div>
						<div
							className='font-heading font-black leading-none'
							style={{ fontSize: 64, letterSpacing: -2, color: tone.ring }}>
							{healthScore}
						</div>
						<div className='mt-1 text-[13px] text-white/40'>out of 100</div>
						<div className='mt-3 text-sm font-semibold text-white/70'>{tone.label}</div>
					</div>
				</div>
			</section>

			{/* ── Category summary ───────────────────────────────────────── */}
			<section className='border-b border-border-soft bg-white px-5 py-6 md:px-10'>
				<div className='mx-auto flex max-w-5xl flex-wrap gap-3'>
					{byCategory.map((c) => (
						<a
							key={c.key}
							href={`#cat-${c.key}`}
							className='min-w-[130px] flex-1 rounded-xl border border-border-soft bg-surface-soft p-3.5 transition hover:border-brand'
							style={{ maxWidth: 200 }}>
							<div className='text-[10px] font-bold uppercase tracking-wide text-muted-ink'>{c.label}</div>
							<div className='mt-1 font-heading text-2xl font-black text-ink'>{c.items.length}</div>
						</a>
					))}
				</div>
			</section>

			{/* ── Issues ─────────────────────────────────────────────────── */}
			<main className='mx-auto max-w-5xl px-5 pb-24 pt-10 md:px-10'>
				{byCategory.map((c) => (
					<section key={c.key} id={`cat-${c.key}`} className='mb-12 scroll-mt-24'>
						<div className='mb-5 flex items-center gap-3'>
							<span className='whitespace-nowrap font-mono text-[10.5px] font-bold uppercase tracking-[2px] text-muted-ink'>
								{c.label} · {c.items.length}
							</span>
							<div className='h-px flex-1 bg-border-soft' />
						</div>
						<div className='flex flex-col gap-3.5'>
							{c.items.map((issue) => (
								<FindingCard
									key={issue.id}
									finding={issue}
									pageLabel={
										multiPage && scanPageIdToUrl ?
											pathOf(
												scanPageIdToUrl[
													(issue as ScanIssue & { scan_page_id?: string }).scan_page_id ?? ''
												] ?? '',
											)
										:	null
									}
								/>
							))}
						</div>
					</section>
				))}

				{issues.length === 0 ? (
					<p className='rounded-xl border border-border-soft bg-white p-6 text-center text-sm text-body'>
						No issues were recorded for this scan.
					</p>
				) : null}

				<div className='rounded-xl border border-border-soft bg-white px-5 py-4 text-[12.5px] leading-relaxed text-muted-ink'>
					<strong className='text-ink'>A note on accuracy:</strong> this report comes from
					automated testing in a real browser with an AI review on top. It is thorough, but
					not infallible — a small number of findings may turn out not to be real once you
					check them by hand. Treat it as a prioritised list to verify, not a verdict.
				</div>

				{mode === 'sample' ? (
					<div
						className={cn(
							'mt-10 rounded-2xl border-2 border-brand p-7 text-center',
						)}
						style={{ background: 'linear-gradient(135deg, #EEF3FD, #F0F9FF)' }}>
						<div className='mb-3 inline-flex items-center gap-2 rounded-full bg-accent-bright px-3 py-1 font-heading text-[11px] font-black uppercase tracking-wide text-white'>
							<Lock className='size-3' />
							Your site, the same way
						</div>
						<h2 className='font-heading text-2xl font-black text-ink'>
							Get this report for your own website
						</h2>
						<p className='mx-auto mt-2 max-w-lg text-[14px] text-body'>
							Start with the free scan — it shows 3 of the issues found at no cost. The full
							report, with every issue, its evidence and its fix, is {formatPackagePrice('basic')}{' '}
							one-time for your homepage.
						</p>
						<Link
							href='/#audit-input'
							className='mt-5 inline-flex items-center justify-center rounded-xl bg-brand px-6 py-3 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-brand-mid'>
							Scan my website free →
						</Link>
					</div>
				) : null}
			</main>
		</div>
	);
}
