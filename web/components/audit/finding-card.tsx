'use client';

import { useEffect, useState } from 'react';
import { Wrench, X, Zap, ZoomIn } from 'lucide-react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils';

/**
 * One issue as the result page and the paid report view show it. Shared by the
 * free preview (3 cards, no fix text — the fix is what the paid report adds),
 * the paid web report and the public sample report.
 */
export type ScanIssue = {
	id: string;
	category: string;
	severity: string;
	title: string;
	description: string;
	impact: string;
	finding_type?: string | null;
	page_section?: string | null;
	/** Developer-facing fix. Null on free previews (stripped server-side). */
	fix_instructions?: string | null;
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

export const CATEGORY_LABEL: Record<string, string> = {
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
export function getIssueEvidence(
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
 * Sits in a fixed-width side column next to the finding text on desktop (the
 * finding text gets the room; the thumbnail is a small proof-of-evidence
 * teaser) and stacks full-width below the text on mobile — sizing is
 * responsive via Tailwind breakpoints, no JS layout logic needed. Element
 * crops render via object-contain (upscaling small crops to fill the column
 * made them a blurry mess); page screenshots use object-cover so an
 * arbitrary-aspect screenshot still fills the thumbnail box cleanly.
 *
 * The lightbox is portalled to <body> (the card has a hover transform, which
 * would break `position: fixed`) and closes on backdrop click, the ✕ button,
 * or Escape.
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
		<>
			<button
				type='button'
				onClick={() => setOpen(true)}
				aria-label={`Enlarge screenshot evidence (${deviceLabel})`}
				title='Click to view full-size evidence'
				className={cn(
					'group relative block w-full overflow-hidden rounded-xl border border-border-soft bg-surface-soft text-left',
					'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
					kind === 'crop' && 'flex items-center justify-center p-2',
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
							'h-[170px] w-full object-cover object-top sm:h-28'
						:	'max-h-[170px] w-auto max-w-full object-contain sm:max-h-28',
					)}
				/>
				{/* Persistent (not hover-only) zoom cue — the column is too narrow on
				    desktop for a text banner, and hover doesn't exist on touch. */}
				<span className='pointer-events-none absolute bottom-1.5 right-1.5 inline-flex size-6 items-center justify-center rounded-full bg-white/95 shadow-sm transition-transform group-hover:scale-110'>
					<ZoomIn className='size-3.5 text-ink' />
				</span>
			</button>
			<span className='mt-1.5 block text-center text-[10.5px] font-semibold text-muted-ink sm:text-left'>
				View evidence
			</span>

			{open &&
				typeof document !== 'undefined' &&
				createPortal(
					<div
						role='dialog'
						aria-modal='true'
						aria-label='Screenshot evidence — full size'
						className='fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-slate-950/85 p-4 sm:p-10'
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
						<span className='text-[12.5px] font-semibold text-white/70'>
							Evidence — captured on your page ({deviceLabel})
						</span>
					</div>,
					document.body,
				)}
		</>
	);
}

// ─── FindingCard ──────────────────────────────────────────────────────────────

export function FindingCard({
	finding,
	pageLabel,
}: {
	finding: ScanIssue;
	/** Shown on multi-page reports so the reader knows which page the issue is on. */
	pageLabel?: string | null;
}) {
	const evidence = getIssueEvidence(finding);
	const normSev = finding.severity.toUpperCase();
	const fix = finding.fix_instructions?.trim() || null;
	const isSuggestion = finding.finding_type === 'suggestion';

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
			<div
				className={cn(
					'flex flex-col gap-4',
					// Thumbnail sits in a fixed-width side column on desktop (text gets
					// the room); on mobile it's a full-width row below the text — order
					// classes reorder visually without touching DOM order.
					evidence && 'sm:flex-row sm:items-start',
				)}>
				{evidence && (
					<div className='order-2 sm:order-1 sm:w-[132px] sm:shrink-0'>
						<EvidenceImage
							src={evidence.src}
							kind={evidence.kind}
							deviceLabel={evidence.deviceLabel}
							alt={`Screenshot evidence: ${finding.title}`}
						/>
					</div>
				)}
				<div className={cn('order-1 min-w-0', evidence && 'sm:order-2 sm:flex-1')}>
					<div className='mb-3 flex flex-wrap items-center gap-2'>
						<span
							className={cn(
								'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-wider',
								tone.badge,
							)}>
							● {normSev}
						</span>
						<span className='text-[11px] font-bold uppercase tracking-widest text-muted-ink'>
							{CATEGORY_LABEL[finding.category] ?? finding.category}
						</span>
						{isSuggestion ? (
							<span className='rounded-full bg-surface-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-ink'>
								Suggestion
							</span>
						) : null}
						{pageLabel ? (
							<span className='truncate font-mono text-[11px] text-muted-ink'>{pageLabel}</span>
						) : null}
					</div>
					<h3 className='font-heading text-[17px] font-extrabold leading-snug text-ink'>
						{finding.title}
					</h3>
					{finding.page_section ? (
						<p className='mt-1 text-[12px] text-muted-ink'>Where: {finding.page_section}</p>
					) : null}
					<p className='mt-2.5 text-[13.5px] leading-[1.65] text-body'>
						{finding.description}
					</p>
					<div className='mt-3.5 flex items-start gap-2 rounded-lg bg-warn-pale px-3.5 py-2.5 text-[12.5px] font-semibold text-[#78350F]'>
						<Zap className='mt-0.5 size-3.5 shrink-0 text-warn' />
						<span>
							<span className='font-extrabold'>Impact:</span> {finding.impact}
						</span>
					</div>
					{fix ? (
						<div className='mt-2.5 flex items-start gap-2 rounded-lg border border-accent-emerald/25 bg-accent-emerald/5 px-3.5 py-2.5 text-[12.5px] text-ink'>
							<Wrench className='mt-0.5 size-3.5 shrink-0 text-accent-emerald' />
							<span className='whitespace-pre-line'>
								<span className='font-extrabold'>How to fix it:</span> {fix}
							</span>
						</div>
					) : null}
				</div>
			</div>
		</article>
	);
}
