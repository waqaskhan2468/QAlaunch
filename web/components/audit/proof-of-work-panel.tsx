'use client';

import type { ProofOfWork } from '@/lib/scan/proof-of-work';

/**
 * "How we tested this" — the panel that answers the objection a real customer
 * raised: the free preview shows three issues, and there are plenty of tools
 * that show three issues.
 *
 * The difference is never going to come from the findings, because every
 * checker produces findings. It comes from the work: a real Chrome browser in
 * the cloud, rendered at multiple widths, links followed, buttons and forms
 * actually clicked, real screenshots reviewed. None of that was visible.
 *
 * The screenshots do the heaviest lifting. A static checker cannot show you a
 * photograph of your own site at 390px, so showing one settles the question
 * without an argument.
 *
 * Every figure comes from buildProofOfWork(), which omits anything the scan
 * did not actually record. The panel renders nothing at all when there is
 * nothing honest to show.
 */
export function ProofOfWorkPanel({
	proof,
	host,
	desktopUrl,
	mobileUrl,
}: {
	proof: ProofOfWork;
	host: string;
	desktopUrl?: string | null;
	mobileUrl?: string | null;
}) {
	const hasStats = proof.stats.length > 0;
	const shots = [
		desktopUrl ? { url: desktopUrl, label: 'Desktop', width: 1280 } : null,
		mobileUrl ? { url: mobileUrl, label: 'Mobile', width: 390 } : null,
	].filter(Boolean) as { url: string; label: string; width: number }[];

	if (!hasStats && shots.length === 0) return null;

	return (
		<section className='mb-8 overflow-hidden rounded-2xl border-2 border-slate-deep bg-white'>
			<div
				className='px-6 py-5 md:px-8'
				style={{ background: 'linear-gradient(135deg, #0F172A, #1E293B)' }}>
				<div className='font-mono text-[10.5px] font-bold uppercase tracking-[2px] text-accent-bright'>
					How we tested {host}
				</div>
				<h2
					className='mt-2 font-heading font-black text-white'
					style={{ fontSize: 23, letterSpacing: -0.6 }}>
					We opened your site in a real browser — not a scan of your code
				</h2>
				<p className='mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-white/55'>
					A cloud Chrome browser loaded {host} the way a visitor would, at real screen
					sizes, then clicked and read what it found.
				</p>
			</div>

			{shots.length > 0 ? (
				<div className='border-b border-border-soft px-6 py-5 md:px-8'>
					<div className='mb-3 font-mono text-[10px] font-bold uppercase tracking-[1.5px] text-muted-ink'>
						Your site, as we actually loaded it
					</div>
					<div className='flex flex-wrap gap-4'>
						{shots.map((s) => (
							<figure key={s.label} className='m-0 flex flex-col gap-1.5'>
								<div
									className='overflow-hidden rounded-lg border border-border-soft bg-surface-soft'
									style={{ width: s.label === 'Mobile' ? 96 : 200, height: 130 }}>
									{/* Supabase storage URL — matches EvidenceImage, which uses a plain
									    <img> so next/image remote config is not required. */}
									{/* eslint-disable-next-line @next/next/no-img-element */}
									<img
										src={s.url}
										alt={`${host} rendered on ${s.label.toLowerCase()}`}
										loading='lazy'
										className='size-full object-cover object-top'
									/>
								</div>
								<figcaption className='font-mono text-[10.5px] text-muted-ink'>
									{s.label} · {s.width}px
								</figcaption>
							</figure>
						))}
					</div>
				</div>
			) : null}

			{hasStats ? (
				<div className='grid grid-cols-2 gap-px bg-border-soft sm:grid-cols-3 lg:grid-cols-5'>
					{proof.stats.map((s) => (
						<div key={s.label} className='bg-white p-4'>
							<div className='font-heading text-[26px] font-black leading-none text-ink'>
								{s.value}
							</div>
							<div className='mt-1.5 text-[12.5px] font-semibold leading-tight text-ink'>
								{s.label}
							</div>
							{s.detail ? (
								<div className='mt-0.5 text-[11.5px] leading-tight text-muted-ink'>
									{s.detail}
								</div>
							) : null}
						</div>
					))}
				</div>
			) : null}

			<div className='border-t border-border-soft bg-surface-soft px-6 py-3.5 md:px-8'>
				<p className='text-[12.5px] leading-relaxed text-muted-ink'>
					Most free checkers read your HTML and grade it. This one runs your site. That is
					why it can tell you a button does nothing, or that a form fails on a phone —
					things that are invisible until the page is actually running.
				</p>
				{/* Asked for by a paying customer, who found a CTA reported as a dead
				    link that worked fine for a human. Saying so up front costs one
				    sentence and keeps the other findings credible. */}
				<p className='mt-2.5 text-[12.5px] leading-relaxed text-muted-ink'>
					<strong className='text-ink'>A note on accuracy:</strong> this is automated
					testing with an AI review on top. It is thorough, but not infallible — a small
					number of findings may turn out not to be real once you check them by hand.
					Treat the report as a prioritised list to check, not a verdict.
				</p>
			</div>
		</section>
	);
}
