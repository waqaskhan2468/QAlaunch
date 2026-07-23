'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Check, Lock, X, Zap, ZoomIn } from 'lucide-react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils';
import { trackFunnelEvent } from '@/lib/analytics/funnel-client';
import { plans } from '@/components/pricing/pricing-plans';
import { computeHealthScore, labelFromScore } from '@/lib/scoring/health';
import {
	allPagesAnalyzed,
	countInterimIssues,
	deriveScanProgressMessage,
} from '@/lib/scan/progressMessage';

// ─── Scan loading ─────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_DURATION_MS = 14 * 60 * 1_000;
// Cosmetic rotation cadence for the crawl sub-labels (within the real phase).
const PROGRESS_ROTATE_MS = 2_500;

// ─── Scan pipeline steps (shown after scan completes) ────────────────────────

// Shown as "What's included in your full report" above the pricing CTA — a list
// of what the full scan tests, NOT a pass/fail checklist. Details describe the
// check, with no ✓ marks (which would imply each area passed).
const SCAN_PIPELINE_STEPS = [
	{ icon: '🌐', name: 'Page Load', detail: 'Load & render' },
	{ icon: '📸', name: 'Screenshots', detail: 'Desktop + mobile' },
	{ icon: '♿', name: 'Accessibility', detail: 'axe-core' },
	{ icon: '🔗', name: 'Link Check', detail: 'All links' },
	{ icon: '📱', name: 'Mobile', detail: '5 viewports' },
	{ icon: '⚡', name: 'Performance', detail: 'PageSpeed' },
	{ icon: '🔍', name: 'SEO', detail: 'Meta + OG' },
	{ icon: '🖱️', name: 'Interactions', detail: 'Forms + CTAs' },
	{ icon: '🤖', name: 'AI Analysis', detail: 'Claude review' },
];

// ─── Category breakdown config ────────────────────────────────────────────────

const CATEGORY_DISPLAY = [
	{ key: 'accessibility', label: 'Accessibility' },
	{ key: 'usability_ux', label: 'Usability' },
	{ key: 'ui_bugs', label: 'UI / Visual' },
	{ key: 'functionality', label: 'Functionality' },
	{ key: 'responsiveness', label: 'Mobile' },
	{ key: 'performance', label: 'Performance' },
	{ key: 'seo', label: 'SEO' },
] as const;

// Real issue count per category (visible + locked), in CATEGORY_DISPLAY order.
function computeCategoryCounts(
	issues: Array<{ category: string; severity: string }>,
) {
	const counts: Record<string, number> = {};
	for (const issue of issues) {
		const cat = issue.category.toLowerCase();
		counts[cat] = (counts[cat] ?? 0) + 1;
	}
	return CATEGORY_DISPLAY.map(({ key, label }) => ({
		key,
		label,
		count: counts[key] ?? 0,
	}));
}

// Tone for a category card based on how many issues it has.
function countTone(count: number): 'warn' | 'bad' {
	return count >= 3 ? 'bad' : 'warn';
}

const SEVERITY_RANK: Record<string, number> = {
	critical: 3,
	high: 2,
	medium: 1,
	low: 0,
};

// Singular/plural noun per category for the locked-issue teaser breakdown.
const CATEGORY_NOUN: Record<string, { one: string; many: string }> = {
	accessibility: { one: 'accessibility issue', many: 'accessibility issues' },
	usability_ux: { one: 'usability issue', many: 'usability issues' },
	ui_bugs: { one: 'UI/visual issue', many: 'UI/visual issues' },
	functionality: { one: 'functionality bug', many: 'functionality bugs' },
	responsiveness: { one: 'mobile issue', many: 'mobile issues' },
	performance: { one: 'performance issue', many: 'performance issues' },
	seo: { one: 'SEO issue', many: 'SEO issues' },
};

function categoryNoun(cat: string, count: number): string {
	const noun = CATEGORY_NOUN[cat];
	if (!noun) return count === 1 ? 'issue' : 'issues';
	return count === 1 ? noun.one : noun.many;
}

// Per-category breakdown of the REAL locked issues, ordered by CATEGORY_DISPLAY.
// maxSev is the highest severity present in that category (drives the "critical"/
// "high" emphasis word) — only categories with at least one locked issue appear.
function lockedCategoryBreakdown(
	lockedIssues: Array<{ category: string; severity: string }>,
) {
	const byCat = new Map<string, { count: number; maxSev: string }>();
	for (const issue of lockedIssues) {
		const cat = issue.category.toLowerCase();
		const sev = issue.severity.toLowerCase();
		const cur = byCat.get(cat);
		if (!cur) {
			byCat.set(cat, { count: 1, maxSev: sev });
		} else {
			cur.count += 1;
			if ((SEVERITY_RANK[sev] ?? -1) > (SEVERITY_RANK[cur.maxSev] ?? -1)) {
				cur.maxSev = sev;
			}
		}
	}
	const order = CATEGORY_DISPLAY.map((c) => c.key) as string[];
	const rank = (cat: string) => {
		const i = order.indexOf(cat);
		return i === -1 ? order.length : i;
	};
	return [...byCat.entries()]
		.map(([cat, { count, maxSev }]) => ({ cat, count, maxSev }))
		.sort((a, b) => rank(a.cat) - rank(b.cat));
}

// ─── Score/grade helpers ──────────────────────────────────────────────────────

function ringColor(score: number): string {
	if (score >= 80) return '#22C55E';
	if (score >= 60) return '#D97706';
	return '#DC2626';
}

function ringTextColor(score: number): string {
	if (score >= 80) return '#22C55E';
	if (score >= 60) return '#FCD34D';
	return '#FCA5A5';
}

function derivedGrade(score: number): string {
	if (score >= 90) return 'A';
	if (score >= 80) return 'B';
	if (score >= 70) return 'C';
	if (score >= 60) return 'D';
	return 'F';
}

function derivedGradeLabel(score: number): string {
	if (score >= 80) return 'GOOD';
	if (score >= 60) return 'NEEDS ATTENTION';
	return 'CRITICAL';
}

function countBySeverity(
	severities: string[],
): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const s of severities) {
		const k = s.toLowerCase();
		counts[k] = (counts[k] ?? 0) + 1;
	}
	return counts;
}

// Free scans only test the homepage. The hero shows a site-wide *estimate* (a
// multiplier band) as a "typical across an entire site" figure — distinct from
// the real homepage issue count. Returns the bare number; the UI appends "+".
// N (real homepage issue count) → displayed band.
function siteWideIssueCount(homepageIssueCount: number): number {
	if (homepageIssueCount >= 11) return 18;
	if (homepageIssueCount >= 8) return 15;
	if (homepageIssueCount >= 5) return 12;
	return 10; // 1–4
}

// ─── Types ────────────────────────────────────────────────────────────────────

type UiState =
	| 'idle'
	| 'starting'
	| 'processing'
	| 'completed'
	| 'failed'
	| 'free_preview_used';

type ScanIssue = {
	id: string;
	category: string;
	severity: string;
	title: string;
	description: string;
	impact: string;
	finding_type?: string | null;
	/** Highlighted evidence crop, or the full page screenshot (see getIssueEvidence). */
	screenshot_url?: string | null;
	/** Evidence highlight in the screenshot's pixel space (AI findings only). */
	bounding_box?: {
		target: 'desktop' | 'mobile';
		x: number;
		y: number;
		width: number;
		height: number;
	} | null;
};

type LockedIssue = {
	id: string;
	category: string;
	severity: string;
	title?: string;
	isLocked: true;
};

type ScanPageStatus = {
	ai_analysis?: {
		status?: string;
		error?: string;
		analysis_mode?: 'full' | 'hybrid' | 'text_only';
		screenshots_available?: boolean;
		issues?: unknown[];
	} | null;
	screenshot_desktop_url?: string | null;
	screenshot_mobile_url?: string | null;
};

type ScanStatusResponse = {
	scan: {
		id: string;
		status: 'pending' | 'crawling' | 'analyzing' | 'done' | 'failed';
		error_message?: string | null;
		package?: string;
	};
	pages?: ScanPageStatus[];
	issues: ScanIssue[];
	lockedIssues: LockedIssue[];
	totalIssueCount: number;
	visibleIssueCount: number;
	lockedIssueCount: number;
	healthScore?: number;
	healthGrade?: string;
	healthLabel?: string;
	previewHealthScore?: number;
};

// ─── Loading helpers ──────────────────────────────────────────────────────────

function pollFetchStatusMessage(hasKnownStatus: boolean): string {
	return hasKnownStatus ? 'Reconnecting…' : 'Checking status…';
}

function userFacingScanError(
	raw: string | undefined | null,
	fallback: string,
): string {
	if (!raw) return fallback;
	if (raw === 'not_found') return 'Scan not found. Check the link or start a new audit.';
	return raw;
}

function loadingCopyForStatus(
	status: ScanStatusResponse['scan']['status'] | null,
): {
	title: string;
	subtitle: string;
	stageLabel: string;
} {
	if (status === 'pending') {
		return {
			title: 'Checking your site…',
			subtitle: 'Making sure your website is reachable before we scan it.',
			stageLabel: 'Checking your site',
		};
	}
	if (status === 'crawling') {
		return {
			title: 'Scanning your website…',
			subtitle: 'Collecting pages, UI states, and performance signals.',
			stageLabel: 'Browser scan',
		};
	}
	if (status === 'analyzing') {
		return {
			title: 'Building your report…',
			subtitle:
				'Automated checks are done. Our AI is reviewing every page — usually 1–2 minutes.',
			stageLabel: 'AI report',
		};
	}
	return {
		title: 'Auditing your website…',
		subtitle: 'Preparing your free preview report.',
		stageLabel: 'Initializing',
	};
}

// ─── Progress steps (free) ────────────────────────────────────────────────────
// Derived purely from the polled scan status, so completed steps stay visible
// with a checkmark and exactly one step is "active" at a time. Free scans skip
// PageSpeed and never produce a PDF/email, so the list ends at AI review.

type ProgressStep = {
	id: string;
	label: string;
	activeOn: ScanStatusResponse['scan']['status'][];
	doneOn: ScanStatusResponse['scan']['status'][];
};

const FREE_PROGRESS_STEPS: ProgressStep[] = [
	{
		id: 'checking',
		label: 'Checking your site',
		activeOn: ['pending'],
		doneOn: ['crawling', 'analyzing', 'done'],
	},
	{
		id: 'scanning',
		label: 'Scanning your homepage',
		activeOn: ['crawling'],
		doneOn: ['analyzing', 'done'],
	},
	{
		id: 'analyzing',
		label: 'Reviewing for issues',
		activeOn: ['analyzing'],
		doneOn: ['done'],
	},
];

function progressStepState(
	step: ProgressStep,
	status: ScanStatusResponse['scan']['status'],
): 'done' | 'active' | 'idle' {
	if (step.doneOn.includes(status)) return 'done';
	if (step.activeOn.includes(status)) return 'active';
	return 'idle';
}

function deriveHost(raw?: string | null): string {
	if (!raw) return 'yourwebsite.com';
	try {
		const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
		return url.hostname;
	} catch {
		return raw;
	}
}

// ─── AuditExperience (public wrapper) ────────────────────────────────────────

type AuditExperienceProps = {
	/** Server-resolved scanId — avoids useSearchParams() staleness during navigation. */
	serverScanId?: string | null;
	serverUrl?: string | null;
	serverFreePreviewUsed?: string | null;
};

export function AuditExperience({
	serverScanId,
	serverUrl,
	serverFreePreviewUsed,
}: AuditExperienceProps = {}) {
	const params = useSearchParams();

	// Prefer server-resolved values (always fresh) over client useSearchParams()
	// which can be stale for ~50-100ms during a route transition, causing a brief
	// flash of the previous scan's data.
	const scanId = serverScanId ?? params.get('scanId') ?? '';
	const url = serverUrl ?? params.get('url') ?? '';
	const freePreviewUsed = serverFreePreviewUsed ?? params.get('freePreviewUsed') ?? '';

	const remountKey = [scanId, url, freePreviewUsed].join('|');
	return (
		<AuditExperienceInner
			key={remountKey}
			resolvedScanId={scanId || null}
			resolvedUrl={url || null}
			resolvedFreePreviewUsed={freePreviewUsed || null}
		/>
	);
}

// ─── AuditExperienceInner ─────────────────────────────────────────────────────

function AuditExperienceInner({
	resolvedScanId,
	resolvedUrl,
	resolvedFreePreviewUsed,
}: {
	resolvedScanId: string | null;
	resolvedUrl: string | null;
	resolvedFreePreviewUsed: string | null;
}) {
	const router = useRouter();
	// Use server-resolved values — never stale
	const inputUrl = resolvedUrl;
	const initialScanId = resolvedScanId;
	const freePreviewUsedParam = resolvedFreePreviewUsed;
	const host = deriveHost(inputUrl);

	const [uiState, setUiState] = useState<UiState>(() => {
		if (freePreviewUsedParam === '1') return 'free_preview_used';
		return initialScanId ? 'processing' : 'idle';
	});
	const [statusData, setStatusData] = useState<ScanStatusResponse | null>(null);
	const [analyzingStartedAt, setAnalyzingStartedAt] = useState<number | null>(null);
	const [analyzingElapsedSec, setAnalyzingElapsedSec] = useState<number | null>(null);
	const [pendingSince, setPendingSince] = useState<number | null>(null);
	const [queuedStuckSec, setQueuedStuckSec] = useState<number | null>(null);
	const [message, setMessage] = useState<string | null>(() =>
		freePreviewUsedParam === '1' ? 'You already used your free preview for this website.' : null,
	);
	const [statusFetchNote, setStatusFetchNote] = useState<string | null>(null);
	const [isRetrying, setIsRetrying] = useState(false);
	// Drives cosmetic rotation of the crawl sub-labels within the real phase.
	const [rotateTick, setRotateTick] = useState(0);

	useEffect(() => {
		const id = window.setInterval(
			() => setRotateTick((t) => t + 1),
			PROGRESS_ROTATE_MS,
		);
		return () => window.clearInterval(id);
	}, []);

	useEffect(() => {
		let cancelled = false;

		if (freePreviewUsedParam === '1') {
			return () => { cancelled = true; };
		}

		const delay = (ms: number) =>
			new Promise<void>((resolve) => { setTimeout(resolve, ms); });

		const pollScanStatus = async (currentScanId: string) => {
			const pollStartedAt = Date.now();
			let hadSuccessfulStatus = false;

			while (!cancelled) {
				if (Date.now() - pollStartedAt > MAX_POLL_DURATION_MS) {
					setUiState('failed');
					setMessage(
						hadSuccessfulStatus ?
							'This audit is taking longer than expected. Please try again.'
						:	'Scan not found. Check the link or start a new audit.',
					);
					return;
				}

				try {
					const res = await fetch(`/api/scan/status/${currentScanId}`, {
						method: 'GET',
						cache: 'no-store',
					});

					if (!res.ok) {
						await res.json().catch(() => null);
						setStatusFetchNote(pollFetchStatusMessage(hadSuccessfulStatus));
						setUiState('processing');
						await delay(POLL_INTERVAL_MS);
						continue;
					}

					const data = (await res.json()) as ScanStatusResponse;
					if (cancelled || data.scan.id !== currentScanId) return;

					hadSuccessfulStatus = true;
					setStatusFetchNote(null);
					setStatusData(data);
					if (data.scan.status === 'pending') {
						setPendingSince((prev) => prev ?? Date.now());
					} else {
						setPendingSince(null);
						setQueuedStuckSec(null);
					}
					if (data.scan.status === 'analyzing') {
						setAnalyzingStartedAt((prev: number | null) => prev ?? Date.now());
					}
					setUiState('processing');

					if (data.scan.status === 'done') {
						const hasNoIssues =
							(data.issues?.length ?? 0) === 0 &&
							(data.totalIssueCount ?? 0) === 0;
						if (hasNoIssues) {
							setUiState('failed');
							setMessage('No findings could be generated for this scan. Please try again.');
							return;
						}
						setUiState('completed');
						return;
					}

					if (data.scan.status === 'failed') {
						setUiState('failed');
						setMessage(
							userFacingScanError(
								data.scan.error_message,
								'Scan failed before completion. Please try again.',
							),
						);
						return;
					}
				} catch {
					setStatusFetchNote(pollFetchStatusMessage(hadSuccessfulStatus));
					setUiState('processing');
				}

				await delay(POLL_INTERVAL_MS);
			}
		};

		const resumeOnly = async () => {
			if (!initialScanId) {
				router.replace('/#audit-input');
				return;
			}

			try {
				const res = await fetch(`/api/scan/status/${initialScanId}`, {
					method: 'GET',
					cache: 'no-store',
				});
				if (cancelled) return;
				if (res.ok) {
					const data = (await res.json()) as ScanStatusResponse;
					if (cancelled || data.scan?.id !== initialScanId) return;
					const pkg = data.scan?.package;
					if (pkg && pkg !== 'free') {
						router.replace(
							`/checkout/success?scanId=${encodeURIComponent(initialScanId)}`,
						);
						return;
					}
				}
			} catch {
				/* continue — free preview may still load */
			}

			if (cancelled) return;
			if (!inputUrl) {
				router.replace('/#audit-input');
				return;
			}

			await pollScanStatus(initialScanId);
		};

		resumeOnly();

		return () => { cancelled = true; };
	}, [freePreviewUsedParam, initialScanId, inputUrl, router]);

	const statusForCurrentScan =
		statusData?.scan?.id === initialScanId ? statusData : null;
	const resultsReady =
		uiState === 'completed' && statusForCurrentScan != null;
	const loadingStatus = statusForCurrentScan?.scan.status ?? null;
	const loadingCopy = loadingCopyForStatus(loadingStatus);

	// Real-state progress message (free scan never produces a PDF/email).
	const loadingPages = statusForCurrentScan?.pages ?? null;
	const progressMessage = deriveScanProgressMessage({
		status: loadingStatus,
		host,
		pageCount: loadingPages?.length ?? null,
		interimIssueCount: countInterimIssues(loadingPages),
		allPagesAnalyzed: allPagesAnalyzed(loadingPages),
		hasReport: false,
		isPaid: false,
		rotateTick,
	});

	useEffect(() => {
		if (loadingStatus !== 'pending' || pendingSince == null) {
			setQueuedStuckSec(null);
			return;
		}
		const id = window.setInterval(() => {
			setQueuedStuckSec(Math.floor((Date.now() - pendingSince) / 1_000));
		}, 1_000);
		return () => window.clearInterval(id);
	}, [loadingStatus, pendingSince]);

	useEffect(() => {
		if (loadingStatus !== 'analyzing' || analyzingStartedAt == null) return;
		const id = window.setInterval(() => {
			setAnalyzingElapsedSec(Math.floor((Date.now() - analyzingStartedAt) / 1_000));
		}, 1_000);
		return () => window.clearInterval(id);
	}, [loadingStatus, analyzingStartedAt]);

	const handleRetryScan = async () => {
		if (!inputUrl || isRetrying) return;
		const value =
			inputUrl.startsWith('http://') || inputUrl.startsWith('https://') ?
				inputUrl
			:	`https://${inputUrl}`;

		setIsRetrying(true);
		setMessage(null);
		try {
			const res = await fetch('/api/scan/start', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: value, package: 'free' }),
			});

			const payload = (await res.json()) as
				| { ok: true; scanId: string }
				| { ok: false; code?: string; message?: string };

			if (
				res.status === 409 &&
				payload.ok === false &&
				payload.code === 'free_preview_used'
			) {
				router.replace(
					`/result?url=${encodeURIComponent(value)}&freePreviewUsed=1`,
				);
				return;
			}

			if (!res.ok || payload.ok !== true || !('scanId' in payload)) {
				// Surface the validation gate reason (unreachable / login page) when present.
				setMessage(
					(payload.ok === false && payload.message) ||
						'Could not restart your audit. Please try again.',
				);
				return;
			}

			router.replace(
				`/result?url=${encodeURIComponent(value)}&scanId=${encodeURIComponent(payload.scanId)}`,
			);
		} catch {
			setMessage('Could not restart your audit. Please try again.');
		} finally {
			setIsRetrying(false);
		}
	};

	// ── Loading state ──────────────────────────────────────────────────────────
	if (
		uiState === 'starting' ||
		uiState === 'processing' ||
		uiState === 'idle' ||
		(uiState === 'completed' && !resultsReady)
	) {
		return (
			<section className='flex min-h-[calc(100vh-4rem)] items-center justify-center bg-surface-soft px-5 py-16'>
				<div className='w-full max-w-xl text-center'>
					<div className='qa-spin mx-auto mb-5 size-16 rounded-full border-4 border-brand-pale border-t-brand' />
					<h1 className='font-heading text-[22px] font-black text-ink'>
						{loadingCopy.title}
					</h1>
					<p className='mt-1.5 text-sm text-body'>
						{loadingCopy.subtitle}{' '}
						<span className='font-mono text-ink'>({host})</span>
					</p>
					<div className='mt-3 flex flex-col items-center gap-2'>
						<div className='inline-flex items-center rounded-full border border-brand/20 bg-brand-pale px-3 py-1 text-xs font-semibold text-brand'>
							Current stage: {loadingCopy.stageLabel}
						</div>
						{statusFetchNote ?
							<p className='text-xs text-muted-ink'>{statusFetchNote}</p>
						:	null}
						{loadingStatus === 'pending' && queuedStuckSec != null && queuedStuckSec >= 45 ?
							<p className='max-w-md text-xs text-warn'>
								Still queued after {queuedStuckSec}s — background jobs may not be
								connected on production. Check Inngest env vars on Vercel
								(INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY, NEXT_PUBLIC_APP_URL).
							</p>
						:	null}
						{analyzingElapsedSec != null ?
							<p className='text-xs text-muted-ink'>
								{analyzingElapsedSec < 90 ?
									`Usually finishes in about ${Math.max(1, 120 - analyzingElapsedSec)}s`
								: analyzingElapsedSec < 150 ?
									'Still working — large sites can take a little longer'
								:	'Taking longer than usual — hang tight or retry if this continues'}
							</p>
						:	null}
					</div>
					{/* Accumulating progress steps — completed steps stay with a green
					    check; exactly one active spinner; the live message is the active
					    step's detail. All derived from the polled scan status. */}
					<div className='mx-auto mt-7 flex max-w-sm flex-col gap-3 text-left'>
						{FREE_PROGRESS_STEPS.map((step) => {
							const state = progressStepState(step, loadingStatus ?? 'pending');
							return (
								<div key={step.id} className='flex items-start gap-3'>
									<div className='mt-0.5 flex size-5 shrink-0 items-center justify-center'>
										{state === 'done' ?
											<span className='flex size-5 items-center justify-center rounded-full bg-accent-bright text-white'>
												<Check className='size-3' strokeWidth={3} />
											</span>
										: state === 'active' ?
											<span className='qa-spin block size-4 rounded-full border-2 border-brand/30 border-t-brand' />
										:	<span className='size-5 rounded-full border-2 border-border-soft' />}
									</div>
									<div className='min-w-0'>
										<p
											className={cn(
												'text-sm font-semibold leading-tight',
												state === 'idle' ? 'text-muted-ink' : 'text-ink',
											)}>
											{step.label}
										</p>
										{state === 'active' && progressMessage ?
											<p className='mt-0.5 text-xs text-body'>{progressMessage}</p>
										:	null}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</section>
		);
	}

	// ── Free preview already used ──────────────────────────────────────────────
	if (uiState === 'free_preview_used') {
		return (
			<section className='flex min-h-[calc(100vh-4rem)] items-center justify-center bg-surface-soft px-5 py-16'>
				<div className='w-full max-w-xl rounded-2xl border border-warn/30 bg-white p-7 text-center shadow-sm'>
					<h1 className='font-heading text-2xl font-black text-ink'>
						Free preview already used
					</h1>
					<p className='mt-2 text-sm text-body'>
						{message ?? 'You have already used the free preview for this website.'}
					</p>
					<div className='mt-5 flex flex-wrap justify-center gap-3'>
						<Link
							href='/pricing'
							className='inline-flex h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-extrabold text-white hover:bg-brand-mid'>
							View paid plans
						</Link>
						<button
							type='button'
							onClick={() => router.push('/')}
							className='inline-flex h-11 items-center justify-center rounded-xl border border-border-soft bg-white px-5 text-sm font-bold text-ink hover:border-brand hover:text-brand'>
							Try another website
						</button>
					</div>
				</div>
			</section>
		);
	}

	// ── Failed state ───────────────────────────────────────────────────────────
	if (uiState === 'failed') {
		return (
			<section className='flex min-h-[calc(100vh-4rem)] items-center justify-center bg-surface-soft px-5 py-16'>
				<div className='w-full max-w-xl rounded-2xl border border-danger/20 bg-white p-7 text-center shadow-sm'>
					<h1 className='font-heading text-2xl font-black text-ink'>
						Audit could not complete
					</h1>
					<p className='mt-2 text-sm text-body'>
						{message ?? 'Please retry your audit in a moment.'}
					</p>
					<div className='mt-5 flex flex-wrap justify-center gap-3'>
						<button
							type='button'
							disabled={isRetrying || !inputUrl}
							onClick={() => void handleRetryScan()}
							className='inline-flex h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-extrabold text-white hover:bg-brand-mid disabled:opacity-60'>
							{isRetrying ? 'Starting…' : 'Retry audit'}
						</button>
						<button
							type='button'
							onClick={() => router.push('/')}
							className='inline-flex h-11 items-center justify-center rounded-xl border border-border-soft bg-white px-5 text-sm font-bold text-ink hover:border-brand hover:text-brand'>
							Back to home
						</button>
					</div>
				</div>
			</section>
		);
	}

	// ── Completed — build results props ────────────────────────────────────────
	const findings = statusForCurrentScan?.issues ?? [];

	const totalIssueCount = statusForCurrentScan?.totalIssueCount ?? findings.length;

	const lockedIssueCount = statusForCurrentScan?.lockedIssueCount ?? 0;

	const lockedIssues = statusForCurrentScan?.lockedIssues ?? [];

	const allKnownSeverities = [
		...(statusForCurrentScan?.issues ?? []).map((f: ScanIssue) => f.severity),
		...(statusForCurrentScan?.lockedIssues ?? []).map((f: LockedIssue) => f.severity),
	];

	const healthScore =
		statusForCurrentScan?.healthScore ?? computeHealthScore(allKnownSeverities);
	const healthLabel =
		statusForCurrentScan?.healthLabel ?? labelFromScore(healthScore) ?? '';

	const incompleteVisualScan = (statusForCurrentScan?.pages ?? []).some(
		(page) => {
			const ai = page.ai_analysis;
			if (ai?.analysis_mode === 'text_only' || ai?.analysis_mode === 'hybrid') {
				return true;
			}
			const hasShots = Boolean(
				page.screenshot_desktop_url || page.screenshot_mobile_url,
			);
			return ai?.status === 'ok' && !hasShots;
		},
	);

	return (
		<ResultsView
			scanId={statusForCurrentScan?.scan.id ?? initialScanId ?? ''}
			host={host}
			inputUrl={inputUrl}
			findings={findings}
			lockedIssues={lockedIssues}
			totalIssueCount={totalIssueCount}
			lockedIssueCount={lockedIssueCount}
			healthScore={healthScore}
			healthLabel={healthLabel}
			incompleteVisualScan={incompleteVisualScan}
		/>
	);
}

// ─── ResultsView ─────────────────────────────────────────────────────────────

type ResultsViewProps = {
	scanId: string;
	host: string;
	inputUrl: string | null;
	findings: ScanIssue[];
	lockedIssues: LockedIssue[];
	totalIssueCount: number;
	lockedIssueCount: number;
	healthScore: number;
	healthLabel: string;
	incompleteVisualScan: boolean;
};

function ResultsView({
	scanId,
	host,
	inputUrl,
	findings,
	lockedIssues,
	totalIssueCount,
	lockedIssueCount,
	healthScore,
	healthLabel,
	incompleteVisualScan,
}: ResultsViewProps) {
	const [ringAnimated, setRingAnimated] = useState(false);
	const [displayScore, setDisplayScore] = useState(0);
	const [showStickyCta, setShowStickyCta] = useState(false);
	const heroRef = useRef<HTMLElement>(null);
	const pricingRef = useRef<HTMLDivElement>(null);
	const lockedRef = useRef<HTMLDivElement>(null);

	// Funnel: the results page actually rendered for the user. Fire once.
	const funnelUrl = inputUrl ?? host;
	const resultsTrackedRef = useRef(false);
	useEffect(() => {
		if (!scanId || resultsTrackedRef.current) return;
		resultsTrackedRef.current = true;
		trackFunnelEvent({ scanId, eventType: 'results_viewed', url: funnelUrl });
	}, [scanId, funnelUrl]);

	// Funnel: the locked-issues / upgrade section scrolled into view. Fire once
	// when it first becomes visible — the truest signal that the user reached the
	// paywall (it sits well below the fold).
	const paywallTrackedRef = useRef(false);
	useEffect(() => {
		const el = lockedRef.current;
		if (!scanId || !el || paywallTrackedRef.current) return;
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting && !paywallTrackedRef.current) {
						paywallTrackedRef.current = true;
						trackFunnelEvent({ scanId, eventType: 'paywall_viewed', url: funnelUrl });
						observer.disconnect();
					}
				}
			},
			{ threshold: 0.2 },
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [scanId, funnelUrl]);

	// Category + severity aggregation over the REAL homepage issues (visible + locked).
	const allIssues = [...findings, ...lockedIssues];
	const categoryCounts = computeCategoryCounts(allIssues);
	const categoriesWithIssues = categoryCounts.filter((c) => c.count > 0);
	const categoriesWithoutIssues = categoryCounts.filter((c) => c.count === 0);
	const severityCounts = countBySeverity(allIssues.map((i) => i.severity));
	const lockedBreakdown = lockedCategoryBreakdown(lockedIssues);

	// Real total — the figure the severity pills add up to (same as "X of Y shown").
	const realIssueCount = totalIssueCount;
	// Number of preview issues shown free below.
	const criticalShownCount = findings.length;
	// Inflated site-wide estimate (bare number; rendered with a trailing "+").
	const inflatedCount = siteWideIssueCount(totalIssueCount);

	// Score ring animation
	const CIRCUMFERENCE = 477;
	const ringOffset = ringAnimated ?
		CIRCUMFERENCE - (CIRCUMFERENCE * healthScore) / 100
	:	CIRCUMFERENCE;
	const color = ringColor(healthScore);
	const textColor = ringTextColor(healthScore);
	const grade = derivedGrade(healthScore);
	const gradeLabel = derivedGradeLabel(healthScore);

	useEffect(() => {
		const t1 = setTimeout(() => setRingAnimated(true), 200);

		// Count-up animation
		let step = 0;
		const steps = 70;
		const id = setInterval(() => {
			step++;
			setDisplayScore(
				Math.min(healthScore, Math.round((healthScore / steps) * step)),
			);
			if (step >= steps) clearInterval(id);
		}, 20);

		return () => {
			clearTimeout(t1);
			clearInterval(id);
		};
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	// Sticky CTA visibility
	useEffect(() => {
		const handler = () => {
			const heroBottom =
				heroRef.current?.getBoundingClientRect().bottom ?? 0;
			const pricingTop =
				pricingRef.current?.getBoundingClientRect().top ?? 9999;
			setShowStickyCta(heroBottom < 0 && pricingTop > 200);
		};
		window.addEventListener('scroll', handler, { passive: true });
		return () => window.removeEventListener('scroll', handler);
	}, []);

	const scrollToPricing = () => {
		pricingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	};

	// ── Tone helpers for category bar colors ──
	const catBarColor = {
		good: '#22C55E',
		warn: '#D97706',
		bad: '#DC2626',
	} as const;

	return (
		<div className='bg-surface-soft'>
			<div className='border-b border-brand/20 bg-brand-pale px-5 py-3 text-center text-sm font-medium text-brand md:px-10'>
				This is a homepage-only preview. A full scan checks every important
				page on your site.
			</div>
			{incompleteVisualScan ?
				<div className='border-b border-amber-200 bg-amber-50 px-5 py-3 text-center text-sm text-amber-950 md:px-10'>
					Visual scan did not finish in time — findings below use{' '}
					<strong>PageSpeed</strong> and automated checks only (no screenshot
					evidence).
				</div>
			:	null}
			{/* ── HERO ──────────────────────────────────────────────────────── */}
			<section
				ref={heroRef}
				style={{
					background: 'linear-gradient(180deg, #0F172A 0%, #1E293B 100%)',
				}}
				className='relative overflow-hidden px-5 pb-14 pt-12 md:px-10'>
				{/* Red pulse overlay */}
				<div
					className='pointer-events-none absolute inset-0'
					style={{
						background:
							'radial-gradient(circle at 18% 55%, rgba(220,38,38,0.18) 0%, transparent 52%)',
						animation: 'qa-pulse-red 4s ease-in-out infinite',
					}}
				/>
				{/* Dot-grid */}
				<div
					className='pointer-events-none absolute inset-0'
					style={{
						backgroundImage:
							'radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)',
						backgroundSize: '24px 24px',
					}}
				/>

				<div className='relative z-10 mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-[1fr_340px]'>
					{/* Left */}
					<div>
						{/* Audit meta */}
						<div className='mb-5 flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-widest text-white/50'>
							<span
								className='block size-2 rounded-full'
								style={{
									background: '#22C55E',
									boxShadow: '0 0 10px rgba(34,197,94,0.6)',
									animation: 'qa-green-pulse 2s ease infinite',
								}}
							/>
							<span>Audit completed</span>
							<span>·</span>
							<span>Homepage scan</span>
						</div>

						{/* Site URL row */}
						<div className='mb-5 flex items-center gap-3'>
							<div className='flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-2xl'>
								🌐
							</div>
							<div>
								<div className='font-mono text-xl font-semibold text-white'>
									{host}
								</div>
								<div className='mt-0.5 text-xs text-white/40'>
									Homepage tested · Free preview · 3 of {totalIssueCount} issues shown
								</div>
							</div>
						</div>

						{/* Alarm headline */}
						<h1
							className='font-heading font-black leading-[1.05] tracking-tight text-white'
							style={{ fontSize: 'clamp(30px, 4vw, 48px)', letterSpacing: '-1.2px' }}>
							Your homepage is{' '}
							<span style={{ color: '#FCA5A5' }}>failing.</span>
							<br />
							<span style={{ color: '#FCA5A5', fontFeatureSettings: '"tnum"' }}>
								{realIssueCount}
							</span>{' '}
							issues found.
						</h1>
						<p className='mt-4 max-w-xl text-[15px] leading-relaxed text-white/65'>
							A full automated + AI review found{' '}
							<strong className='text-white'>{realIssueCount} issues on your homepage</strong>{' '}
							actively affecting how real visitors experience it.{' '}
							<strong className='text-white'>
								{criticalShownCount} critical issues are shown free below.
							</strong>
						</p>
						<p className='mt-3 max-w-xl text-[12.5px] leading-relaxed text-white/45'>
							This is a homepage-only preview — {inflatedCount}+ issues are typical
							across an entire site. Run a full scan to check your other pages too.
						</p>

						{/* Severity chips */}
						<div className='mt-6 flex flex-wrap gap-2.5'>
							{[
								{
									key: 'critical',
								label: 'Critical',
								bg: 'rgba(220,38,38,0.15)',
								border: 'rgba(220,38,38,0.3)',
								text: '#FCA5A5',
							},
							{
								key: 'high',
								label: 'High',
								bg: 'rgba(217,119,6,0.15)',
								border: 'rgba(217,119,6,0.3)',
								text: '#FCD34D',
							},
							{
								key: 'medium',
								label: 'Medium',
								bg: 'rgba(37,88,212,0.15)',
								border: 'rgba(37,88,212,0.3)',
								text: '#93C5FD',
							},
							{
								key: 'low',
								label: 'Low',
								bg: 'rgba(255,255,255,0.06)',
								border: 'rgba(255,255,255,0.12)',
								text: 'rgba(255,255,255,0.65)',
							},
						]
							.filter((chip) => (severityCounts[chip.key] ?? 0) > 0)
							.map((chip) => (
								<div
									key={chip.key}
									className='inline-flex items-center gap-2 rounded-full px-3.5 py-2 font-mono text-[12px] font-semibold'
									style={{
										background: chip.bg,
										border: `1px solid ${chip.border}`,
										color: chip.text,
									}}>
									<span
										className='font-heading text-[14px] font-black'
										style={{ fontVariantNumeric: 'tabular-nums' }}>
										{severityCounts[chip.key] ?? 0}
									</span>
									{chip.label}
								</div>
							))}
					</div>
				</div>

				{/* Right — score ring */}
				<div
					className='flex flex-col items-center rounded-2xl p-8 text-center'
					style={{
						background: 'rgba(255,255,255,0.04)',
						border: '1px solid rgba(255,255,255,0.1)',
					}}>
					<div className='mb-4 font-mono text-[11px] uppercase tracking-[2.5px] text-white/40'>
						Overall Health Score
					</div>
					<div className='relative size-[180px]'>
						<svg
							width='180'
							height='180'
							viewBox='0 0 180 180'
							style={{ transform: 'rotate(-90deg)' }}>
							<defs>
								<linearGradient id='scoreGrad' x1='0%' y1='0%' x2='100%' y2='100%'>
									<stop offset='0%' stopColor={color} />
									<stop offset='100%' stopColor={color} stopOpacity={0.6} />
								</linearGradient>
							</defs>
							<circle
								cx='90'
								cy='90'
								r='76'
								fill='none'
								stroke='rgba(255,255,255,0.07)'
								strokeWidth='14'
							/>
							<circle
								cx='90'
								cy='90'
								r='76'
								fill='none'
								stroke={color}
								strokeWidth='14'
								strokeLinecap='round'
								strokeDasharray={CIRCUMFERENCE}
								strokeDashoffset={ringOffset}
								style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)' }}
							/>
						</svg>
						<div className='absolute inset-0 flex flex-col items-center justify-center'>
							{healthScore === 0 ? (
								<span
									className='font-heading font-black leading-none'
									style={{ fontSize: 34, letterSpacing: -1, color: '#FCA5A5' }}>
									CRIT
								</span>
							) : (
								<span
									className='font-heading font-black leading-none'
									style={{ fontSize: 62, letterSpacing: -2, color: textColor }}>
									{displayScore}
								</span>
							)}
							<span className='mt-1 text-[13px] text-white/40'>out of 100</span>
						</div>
					</div>
					<div
						className='mb-2 mt-2 inline-block rounded-full px-4 py-1.5 font-heading text-[12px] font-black tracking-wider'
						style={{
							background:
								healthScore >= 80 ?
									'rgba(34,197,94,0.2)'
								: healthScore >= 60 ?
									'rgba(217,119,6,0.2)'
								:	'rgba(220,38,38,0.2)',
							color: textColor,
						}}>
						{gradeLabel} — {grade} GRADE
					</div>
					<p className='text-sm text-white/60'>
						{healthLabel || 'Your site needs attention'}
					</p>
				</div>
			</div>
		</section>

		{/* ── ISSUES BY CATEGORY ────────────────────────────────────────── */}
		{/* Real issue counts per category — only categories that actually have
		    issues get a card; zero-issue categories are grouped, de-emphasized,
		    below so they don't visually compete with the real problems. */}
		<section className='border-b border-border-soft bg-white px-5 py-6 md:px-10'>
			<div className='mx-auto max-w-5xl'>
				<div className='mb-4 flex items-center gap-3'>
					<span className='whitespace-nowrap font-mono text-[10.5px] font-bold uppercase tracking-[2px] text-muted-ink'>
						Issues by category
					</span>
					<div className='h-px flex-1 bg-border-soft' />
				</div>
				{categoriesWithIssues.length > 0 ? (
					<div className='flex flex-wrap gap-3'>
						{categoriesWithIssues.map(({ key, label, count }) => {
							const tone = countTone(count);
							return (
								<div
									key={key}
									className='min-w-[130px] flex-1 rounded-xl border border-border-soft bg-surface-soft p-3.5 transition-transform hover:-translate-y-0.5'
									style={{ maxWidth: 200 }}>
									<div className='mb-1.5 text-[9px] font-bold uppercase leading-tight tracking-wide break-words text-muted-ink sm:text-[10px]'>
										{label}
									</div>
									<div
										className='font-heading text-2xl font-black leading-none'
										style={{ color: catBarColor[tone] }}>
										{count}
									</div>
									<div className='mt-1 text-[11px] font-semibold text-body'>
										{count === 1 ? 'issue found' : 'issues found'}
									</div>
								</div>
							);
						})}
					</div>
				) : null}
				{categoriesWithoutIssues.length > 0 ? (
					<p className='mt-4 text-[12px] leading-relaxed text-muted-ink'>
						<span className='font-semibold text-accent-bright'>No issues found:</span>{' '}
						{categoriesWithoutIssues.map((c) => c.label).join(', ')}
					</p>
				) : null}
			</div>
		</section>

		{/* ── MAIN CONTENT ──────────────────────────────────────────────── */}
		<main className='mx-auto max-w-5xl px-5 pb-28 pt-12 md:px-10'>
			{/* Tease banner */}
			<div
				className='mb-8 flex items-start gap-3.5 rounded-xl border p-5'
				style={{
					background: 'linear-gradient(135deg, #FEF2F2, #FFFBEB)',
					borderColor: 'rgba(217,119,6,0.3)',
				}}>
				<div className='flex size-9 shrink-0 items-center justify-center rounded-xl bg-danger text-lg text-white'>
					⚠
				</div>
				<div>
					<div className='font-heading text-[14.5px] font-extrabold text-danger'>
						3 of {totalIssueCount} issues shown · {lockedIssueCount} issues remain locked
					</div>
					<p className='mt-0.5 text-[13px] leading-snug' style={{ color: '#7C2D12' }}>
						Your visitors are hitting{' '}
						<strong style={{ color: '#991B1B' }}>all {totalIssueCount} issues</strong>{' '}
						right now — not just the 3 below. Unlock the full report for every issue
						with <strong style={{ color: '#991B1B' }}>screenshot evidence</strong> and{' '}
						<strong style={{ color: '#991B1B' }}>developer-ready fix instructions</strong>.
					</p>
				</div>
			</div>

			{/* Section label */}
			<div className='mb-5 flex items-center gap-3'>
				<span className='whitespace-nowrap font-mono text-[10.5px] font-bold uppercase tracking-[2px] text-muted-ink'>
					Free preview · 3 most critical issues
				</span>
				<div className='h-px flex-1 bg-border-soft' />
			</div>

			{/* Issue cards */}
			<div className='flex flex-col gap-3.5'>
				{findings.map((f) => (
					<FindingCard key={f.id} finding={f} />
				))}
			</div>

			{/* ── LOCKED SECTION ──────────────────────────────────────────── */}
			<div
				ref={lockedRef}
				className='mt-12 overflow-hidden rounded-2xl border-2 border-border-soft bg-white'>
				{/* Dark header */}
				<div
					className='relative overflow-hidden px-8 py-7 text-center'
					style={{ background: 'linear-gradient(135deg, #0F172A, #1E293B)' }}>
					<div
						className='pointer-events-none absolute inset-0'
						style={{
							backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
							backgroundSize: '20px 20px',
						}}
					/>
					<div
						className='relative z-10 mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest'
						style={{
							background: 'rgba(220,38,38,0.15)',
							border: '1px solid rgba(220,38,38,0.3)',
							color: '#FCA5A5',
						}}>
						<Lock className='size-3' />
						Locked · Full report only
					</div>
					<h2
						className='relative z-10 font-heading font-black text-white'
						style={{ fontSize: 28, letterSpacing: -1 }}>
						<span style={{ color: '#FCA5A5' }}>{lockedIssueCount} more issues</span>{' '}
						found on your site
					</h2>
					<p className='relative z-10 mt-1.5 text-sm text-white/55'>
						Each one is actively affecting how real visitors experience your website
					</p>
				</div>

				{/* Real breakdown of what's locked, by category. Only categories with
				    locked issues appear — the titles themselves stay paywalled below. */}
				{lockedBreakdown.length > 0 ? (
					<div className='border-b border-border-soft px-6 py-5'>
						<div className='mb-3 font-mono text-[10.5px] font-bold uppercase tracking-[1.5px] text-muted-ink'>
							What&apos;s locked in your full report
						</div>
						<ul className='flex flex-col gap-2'>
							{lockedBreakdown.map(({ cat, count, maxSev }) => (
								<li
									key={cat}
									className='flex items-center gap-2 text-[13.5px] font-semibold text-ink'>
									<Lock className='size-3.5 shrink-0 text-danger' />
									<span>
										{count}{' '}
										{maxSev === 'critical' ? (
											<span className='text-danger'>critical </span>
										) : maxSev === 'high' ? (
											<span className='text-warn'>high-severity </span>
										) : null}
										{categoryNoun(cat, count)}
									</span>
								</li>
							))}
						</ul>
					</div>
				) : null}

				{/* Redacted preview — real titles are paywalled. These rows are
				    intentionally fake + blurred so the full list stays locked. */}
				<div className='relative px-6 pb-2 pt-5'>
					{LOCKED_PLACEHOLDERS.map((placeholder, i) => (
						<BlurredIssueRow
							key={i}
							severity={placeholder.severity}
							text={placeholder.text}
						/>
					))}
					{/* Gradient overlay reinforces the locked-behind-paywall feel */}
					<div
						className='pointer-events-none absolute inset-x-0 bottom-0 h-28'
						style={{
							background:
								'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(248,250,252,0.92) 100%)',
						}}
					/>
				</div>

				{/* Unlock CTA */}
				<div
					className='mx-6 mb-6 rounded-xl border-2 border-brand p-6 text-center'
					style={{ background: 'linear-gradient(135deg, #EEF3FD, #F0F9FF)' }}>
					<div className='mb-3 inline-flex items-center gap-2 rounded-full bg-accent-bright px-3 py-1 font-heading text-[11px] font-black uppercase tracking-wide text-white'>
						⚡ Instant unlock
					</div>
					<h3 className='font-heading text-xl font-black text-ink'>
						Unlock your full audit report
					</h3>
					<p className='mt-1.5 text-[13.5px] text-body'>
						Get every issue with screenshot evidence and step-by-step fix instructions
					</p>
					<div className='mt-5 flex flex-col items-center gap-3'>
						<button
							type='button'
							onClick={scrollToPricing}
							className='inline-flex items-center justify-center rounded-xl bg-brand px-6 py-3 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-brand-mid hover:shadow-lg hover:shadow-brand/30'>
							Get Full Report →
						</button>
						<span className='font-mono text-[13px] font-semibold text-body'>
							From <strong className='text-ink'>$9</strong> · One-time payment · Instant PDF delivery
						</span>
						<span className='text-[12px] text-muted-ink'>
							Not satisfied?{' '}
							<Link href='/refund' className='font-semibold text-brand hover:underline'>
								Full refund
							</Link>{' '}
							if we can&apos;t generate your report.
						</span>
					</div>
				</div>
			</div>

			{/* ── TRUST STRIP ──────────────────────────────────────────── */}
			<div className='mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4'>
				{[
					{ ico: '⚡', t: 'Instant Delivery', s: 'PDF in your inbox in 120 seconds' },
					{ ico: '🛡️', t: '100% Refund', s: "If you don't find it useful" },
					{ ico: '👤', t: 'Built by Experts', s: '9 years of senior QA experience' },
					{ ico: '🔁', t: 'No Subscription', s: 'Pay once — own the report forever' },
				].map((item) => (
					<div
						key={item.t}
						className='flex items-center gap-3 rounded-xl border border-border-soft bg-white p-4'>
						<div className='flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-pale text-[16px]'>
							{item.ico}
						</div>
						<div>
							<div className='text-[12.5px] font-bold text-ink'>{item.t}</div>
							<div className='mt-0.5 text-[11.5px] text-muted-ink'>{item.s}</div>
						</div>
					</div>
				))}
			</div>

			{/* ── WHAT'S INCLUDED ───────────────────────────────────────── */}
			{/* A list of what the full scan tests — NOT a pass/fail checklist.
			    Neutral styling (no green ✓) so it reads as coverage, not results.
			    Sits directly above the pricing CTA. */}
			<div className='mt-14 rounded-2xl border border-border-soft bg-white p-6 md:p-7'>
				<div className='mb-5 flex items-center gap-3'>
					<span className='font-mono text-[10.5px] font-bold uppercase tracking-[2px] text-muted-ink'>
						What&apos;s included in your full report
					</span>
					<div className='h-px flex-1 bg-border-soft' />
				</div>
				<div className='flex gap-0 overflow-x-auto pb-1' style={{ scrollbarWidth: 'none' }}>
					{SCAN_PIPELINE_STEPS.map((step, i) => (
						<div
							key={step.name}
							className='relative flex min-w-[100px] flex-1 flex-col items-center'>
							{i < SCAN_PIPELINE_STEPS.length - 1 && (
								<div
									className='absolute top-[17px] h-0.5 bg-border-soft'
									style={{ left: 'calc(50% + 18px)', right: 'calc(-50% + 18px)' }}
								/>
							)}
							<div className='relative z-10 mb-2 flex size-9 items-center justify-center rounded-full border-2 border-brand/25 bg-brand-pale text-[15px]'>
								{step.icon}
							</div>
							<div className='text-center text-[11px] font-bold leading-tight text-ink'>
								{step.name}
							</div>
							<div className='mt-0.5 text-center font-mono text-[10px] font-semibold text-muted-ink'>
								{step.detail}
							</div>
						</div>
					))}
				</div>
			</div>

			{/* ── PRICING ───────────────────────────────────────────────── */}
			<div ref={pricingRef} className='mt-14' id='pricing'>
				<div className='mb-8 text-center'>
					<div className='mb-2 font-mono text-[11px] font-bold uppercase tracking-[2.5px] text-brand'>
						Choose your plan
					</div>
					<h2 className='font-heading text-3xl font-black text-ink' style={{ letterSpacing: -0.8 }}>
						Get your full audit report
					</h2>
					<p className='mt-2 text-[15px] text-body'>
						One-time payment. PDF delivered instantly. Share directly with your developer.
					</p>
				</div>

				<div className='mx-auto mb-7 flex max-w-lg flex-wrap items-center justify-center gap-4 rounded-xl bg-ink px-6 py-4 text-[13.5px] text-white'>
					<div className='flex items-center gap-2'>
						<span className='text-white/60'>Manual QA audit (typical):</span>
						<span className='line-through opacity-60'>$200–$500</span>
					</div>
					<span className='text-white/40'>→</span>
					<div className='flex items-center gap-2'>
						<span className='text-white/60'>QAlaunch:</span>
						<span className='font-extrabold text-accent-bright'>From $9</span>
					</div>
				</div>

				<div className='grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4'>
					{plans.map((plan) => (
						<MiniPlanCard key={plan.tier} plan={plan} prefillUrl={inputUrl} />
					))}
				</div>

				<div className='mt-8 flex flex-wrap items-center justify-center gap-4 rounded-xl border border-border-soft bg-white px-6 py-5 text-center'>
					<div className='flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-pale text-2xl'>
						🛡️
					</div>
					<div>
						<div className='font-heading text-[15px] font-extrabold text-ink'>
							100% Money-Back Guarantee
						</div>
						<div className='mt-0.5 text-[13px] text-body'>
							If the report doesn&apos;t help you find at least 3 actionable issues, we&apos;ll refund you in full — no questions asked.
						</div>
					</div>
				</div>
			</div>
		</main>

		{/* ── STICKY CTA BAR ────────────────────────────────────────────── */}
		{showStickyCta && (
			<div
				className='fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 px-5 py-3.5 backdrop-blur-xl'
				style={{ background: 'rgba(9,17,31,0.98)' }}>
				<div className='mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4'>
					<div className='flex items-center gap-4'>
						<div
							className='flex size-11 shrink-0 items-center justify-center rounded-xl text-lg'
							style={{
								background: 'rgba(220,38,38,0.18)',
								border: '1px solid rgba(220,38,38,0.35)',
								color: '#FCA5A5',
							}}>
							⚠
						</div>
						<div>
							<div className='font-heading text-[14.5px] font-extrabold text-white'>
								{lockedIssueCount} more issues found on your website
							</div>
							<div className='text-[12px] text-white/50'>
								Unlock the full report — all {totalIssueCount} issues + fix instructions
							</div>
						</div>
					</div>
					<div className='flex items-center gap-2.5'>
						<button
							type='button'
							onClick={scrollToPricing}
							className='rounded-xl border border-white/15 bg-transparent px-4 py-2.5 text-[13px] font-semibold text-white/70 transition hover:bg-white/5 hover:text-white'>
							View Pricing
						</button>
						<button
							type='button'
							onClick={scrollToPricing}
							className='rounded-xl bg-accent-bright px-5 py-2.5 text-[13.5px] font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-accent-bright/90 hover:shadow-lg'>
							Unlock Full Report →
						</button>
					</div>
				</div>
			</div>
		)}
	</div>
	);
}

// ─── Evidence image (screenshot proof on a finding card) ─────────────────────

/**
 * Decide what visual evidence a finding can show:
 *  - a pre-highlighted element crop (uploaded under `/crop-…`, see
 *    lib/scan/screenshot-paths.ts) renders at natural size — never upscaled;
 *  - an AI finding that carried a bounding box renders the page screenshot as
 *    a thumbnail. The box itself is deliberately NOT drawn — model-produced
 *    boxes are not yet reliable enough, and a wrong annotation costs more
 *    trust than no annotation. Its presence is used only as a signal that the
 *    finding is visual and worth showing a screenshot for.
 * A bare full-page screenshot with no box proves nothing and would repeat the
 * same image under every card, so it renders no evidence at all.
 */
function getIssueEvidence(
	finding: ScanIssue,
): { src: string; kind: 'crop' | 'page'; deviceLabel: string } | null {
	const src = finding.screenshot_url;
	if (!src) return null;

	if (src.includes('/crop-')) {
		return { src, kind: 'crop', deviceLabel: 'desktop view' };
	}

	const box = finding.bounding_box;
	if (box && box.width > 0 && box.height > 0) {
		return {
			src,
			kind: 'page',
			deviceLabel: box.target === 'mobile' ? 'mobile view' : 'desktop view',
		};
	}

	return null;
}

/**
 * Compact evidence thumbnail with a click-to-enlarge lightbox.
 *
 * Thumbnails keep the results page short: page screenshots render as a fixed-
 * height top-crop; element crops render at their natural size (upscaling small
 * crops to card width made them a blurry mess). The lightbox is portalled to
 * <body> (the card has a hover transform, which would break `position: fixed`)
 * and closes on backdrop click, the ✕ button, or Escape.
 */
function EvidenceImage({
	src,
	kind,
	deviceLabel,
	alt,
}: {
	src: string;
	kind: 'crop' | 'page';
	deviceLabel: string;
	alt: string;
}) {
	const [open, setOpen] = useState(false);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		if (!open) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setOpen(false);
		};
		document.addEventListener('keydown', onKey);
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.removeEventListener('keydown', onKey);
			document.body.style.overflow = previousOverflow;
		};
	}, [open]);

	if (failed) return null;

	return (
		<figure className='mt-4'>
			<button
				type='button'
				onClick={() => setOpen(true)}
				aria-label='Enlarge screenshot evidence'
				className={cn(
					'group relative block w-full overflow-hidden rounded-xl border border-border-soft bg-surface-soft text-left',
					'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
					kind === 'crop' && 'flex justify-center p-2',
				)}>
				{/* Supabase storage URL — next/image remote config not needed for evidence shots. */}
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img
					src={src}
					alt={alt}
					loading='lazy'
					onError={() => setFailed(true)}
					className={cn(
						kind === 'page' ?
							'h-[170px] w-full object-cover object-top'
						:	'max-h-[170px] w-auto max-w-full object-contain',
					)}
				/>
				<span className='pointer-events-none absolute inset-x-0 bottom-0 flex justify-end bg-gradient-to-t from-black/20 to-transparent p-2'>
					<span className='inline-flex items-center gap-1 rounded-md bg-white/95 px-2 py-1 text-[10.5px] font-bold text-ink shadow-sm transition-transform group-hover:scale-105'>
						<ZoomIn className='size-3' /> Click to enlarge
					</span>
				</span>
			</button>
			<figcaption className='mt-1.5 text-[11px] font-semibold text-muted-ink'>
				Evidence — captured on your page ({deviceLabel})
			</figcaption>

			{open &&
				typeof document !== 'undefined' &&
				createPortal(
					<div
						role='dialog'
						aria-modal='true'
						aria-label='Screenshot evidence — full size'
						className='fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-4 sm:p-10'
						onClick={() => setOpen(false)}>
						<button
							type='button'
							onClick={() => setOpen(false)}
							aria-label='Close screenshot preview'
							className='absolute right-4 top-4 z-10 inline-flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25'>
							<X className='size-5' />
						</button>
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img
							src={src}
							alt={alt}
							className='max-h-full max-w-full rounded-lg object-contain shadow-2xl'
							onClick={(event) => event.stopPropagation()}
						/>
					</div>,
					document.body,
				)}
		</figure>
	);
}

// ─── FindingCard ──────────────────────────────────────────────────────────────

function FindingCard({ finding }: { finding: ScanIssue }) {
	const evidence = getIssueEvidence(finding);
	const normSev = finding.severity.toUpperCase();
	const normCat = (v: string) => {
		const map: Record<string, string> = {
			functionality: 'Functionality',
			ui_bugs: 'UI Bugs',
			usability_ux: 'Usability',
			responsiveness: 'Mobile',
			performance: 'Performance',
			seo: 'SEO',
			accessibility: 'Accessibility',
			security: 'Security',
			content: 'Content',
		};
		return map[v] ?? v;
	};

	const tone = {
		CRITICAL: { card: 'border-l-[4px] border-l-danger', badge: 'bg-danger-pale text-danger' },
		HIGH:     { card: 'border-l-[4px] border-l-warn',   badge: 'bg-warn-pale text-warn'     },
		MEDIUM:   { card: 'border-l-[4px] border-l-brand',  badge: 'bg-brand-pale text-brand'   },
		LOW:      { card: 'border-l-[4px] border-l-muted-ink', badge: 'bg-surface-soft text-muted-ink' },
	}[normSev] ?? { card: 'border-l-[4px] border-l-brand', badge: 'bg-brand-pale text-brand' };

	return (
		<article
			className={cn(
				'rounded-2xl border-[1.5px] border-border-soft bg-white p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5',
				tone.card,
			)}>
			<div className='mb-3 flex flex-wrap items-center gap-2'>
				<span
					className={cn(
						'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-wider',
						tone.badge,
					)}>
					● {normSev}
				</span>
				<span className='text-[11px] font-bold uppercase tracking-widest text-muted-ink'>
					{normCat(finding.category)}
				</span>
			</div>
			<h3 className='font-heading text-[17px] font-extrabold leading-snug text-ink'>
				{finding.title}
			</h3>
			<p className='mt-2.5 text-[13.5px] leading-[1.65] text-body'>
				{finding.description}
			</p>
			<div className='mt-3.5 flex items-start gap-2 rounded-lg bg-warn-pale px-3.5 py-2.5 text-[12.5px] font-semibold text-[#78350F]'>
				<Zap className='mt-0.5 size-3.5 shrink-0 text-warn' />
				<span>
					<span className='font-extrabold'>Impact:</span> {finding.impact}
				</span>
			</div>
			{evidence && (
				<EvidenceImage
					src={evidence.src}
					kind={evidence.kind}
					deviceLabel={evidence.deviceLabel}
					alt={`Screenshot evidence: ${finding.title}`}
				/>
			)}
		</article>
	);
}

// ─── BlurredIssueRow (paywalled placeholder) ──────────────────────────────────
// Real locked-issue titles are intentionally NOT rendered here. These decorative
// rows look like genuine findings but are fake + blurred so the remaining issues
// stay behind the paywall.

const LOCKED_PLACEHOLDERS: Array<{
	severity: 'critical' | 'high' | 'medium';
	text: string;
}> = [
	{ severity: 'critical', text: 'Checkout submit button fails on common mobile viewport widths' },
	{ severity: 'high', text: 'Primary navigation links return broken 404 responses' },
	{ severity: 'high', text: 'Key images missing alt text, hurting accessibility and SEO' },
	{ severity: 'medium', text: 'Meta descriptions exceed the recommended length on landing pages' },
	{ severity: 'medium', text: 'Interactive tap targets are too small for comfortable mobile use' },
];

function BlurredIssueRow({
	severity,
	text,
}: {
	severity: 'critical' | 'high' | 'medium';
	text: string;
}) {
	const badgeTone = {
		critical: 'bg-danger-pale text-danger',
		high:     'bg-warn-pale text-warn',
		medium:   'bg-brand-pale text-brand',
	}[severity];

	return (
		<div className='mb-2 flex items-center gap-3 rounded-xl border border-border-soft bg-surface-soft px-4 py-3.5'>
			<span
				className={cn(
					'shrink-0 rounded-full px-2.5 py-1 font-heading text-[10px] font-extrabold uppercase tracking-wide',
					badgeTone,
				)}>
				{severity}
			</span>
			{/* Blurred, non-selectable placeholder where the real title would be */}
			<span
				aria-hidden='true'
				className='min-w-0 flex-1 select-none truncate text-[13.5px] font-semibold text-ink'
				style={{ filter: 'blur(5px)', userSelect: 'none' }}>
				{text}
			</span>
			<Lock className='size-3.5 shrink-0 text-muted-ink opacity-60' />
		</div>
	);
}

// ─── MiniPlanCard ─────────────────────────────────────────────────────────────

function MiniPlanCard({
	plan,
	prefillUrl,
}: {
	plan: (typeof plans)[number];
	prefillUrl: string | null;
}) {
	const checkoutHref =
		plan.checkoutPackage != null ?
			`/checkout?package=${plan.checkoutPackage}${
				prefillUrl ? `&url=${encodeURIComponent(prefillUrl)}` : ''
			}`
		:	'/contact';

	return (
		<article
			className={cn(
				'relative flex flex-col rounded-2xl border bg-white p-5 transition-all hover:-translate-y-1 hover:border-brand hover:shadow-xl hover:shadow-brand/10',
				plan.popular ?
					'border-2 border-brand bg-gradient-to-b from-brand-pale to-white'
				:	'border-border-soft',
			)}>
			{plan.popular && (
				<span className='absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand px-3 py-0.5 text-[10.5px] font-extrabold text-white'>
					⭐ Most Popular
				</span>
			)}
			<div className='text-[11px] font-bold uppercase tracking-wider text-muted-ink'>
				{plan.tier}
			</div>
			<div className='mt-1 font-heading text-2xl font-black text-ink'>
				{plan.priceSymbol ? `${plan.priceSymbol}${plan.price}` : plan.price}{' '}
				<span className='text-sm font-medium text-muted-ink'>
					{plan.price === 'Custom' ? 'quote' : 'one-time'}
				</span>
			</div>
			<div className='mt-0.5 text-xs text-body'>{plan.pages}</div>
			<ul className='my-3.5 flex flex-1 flex-col gap-1.5'>
				{plan.features.slice(0, 4).map((f) => (
					<li key={f} className='flex items-start gap-1.5 text-[12px] text-ink'>
						<Check className='mt-0.5 size-3 shrink-0 text-accent-bright' strokeWidth={3} />
						{f}
					</li>
				))}
			</ul>
			<Link
				href={checkoutHref}
				className={cn(
					'mt-auto inline-flex w-full items-center justify-center rounded-xl px-3 py-2.5 text-[13px] font-extrabold transition-all',
					plan.popular ?
						'bg-brand text-white hover:bg-brand-mid'
					:	'border border-border-soft bg-white text-ink hover:border-brand hover:text-brand',
				)}>
				Get {plan.tier}
			</Link>
		</article>
	);
}
