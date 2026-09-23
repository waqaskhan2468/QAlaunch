'use client';

import { useState } from 'react';

/**
 * Done-for-you manual audit — the high-ticket offer on the result page.
 *
 * Sits below the $9 report rather than replacing it. The two serve different
 * buyers: a hobbyist testing a weekend build wants the $9 PDF, while a business
 * that loses money when its checkout breaks wants a person to go through the
 * whole site. The scan logs are full of the second kind — a plumber, a pharmacy,
 * an eye clinic — and the automated report was the only thing ever offered them.
 *
 * The price is shown even though this is an enquiry, not a checkout. A hidden
 * price fills the inbox with people who assumed it was free; a visible one means
 * only serious enquiries arrive, which matters when replies cost the operator
 * their evening.
 */

const TURNAROUND = '3 business days';
const PRICE = '$299';

type Status = 'idle' | 'sending' | 'sent' | 'error';

export function AuditEnquiry({
	websiteUrl,
	scanId,
	host,
}: {
	websiteUrl: string | null;
	scanId: string | null;
	host: string;
}) {
	const [open, setOpen] = useState(false);
	const [status, setStatus] = useState<Status>('idle');
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (status === 'sending') return;

		const form = new FormData(e.currentTarget);
		const payload = {
			name: String(form.get('name') ?? '').trim(),
			email: String(form.get('email') ?? '').trim(),
			whatsapp: String(form.get('whatsapp') ?? '').trim() || undefined,
			concern: String(form.get('concern') ?? '').trim() || undefined,
			websiteUrl: websiteUrl ?? undefined,
			scanId: scanId ?? undefined,
		};

		setStatus('sending');
		setError(null);
		try {
			const res = await fetch('/api/audit-enquiry', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			const data = (await res.json().catch(() => null)) as
				| { ok?: boolean; message?: string }
				| null;
			if (!res.ok || !data?.ok) {
				setStatus('error');
				setError(data?.message ?? 'Something went wrong. Please try again.');
				return;
			}
			setStatus('sent');
		} catch {
			setStatus('error');
			setError('Could not reach the server. Please check your connection and try again.');
		}
	}

	return (
		<div className='mt-8 overflow-hidden rounded-2xl border-2 border-slate-deep bg-white'>
			<div
				className='px-6 py-5 md:px-8'
				style={{ background: 'linear-gradient(135deg, #0F172A, #1E293B)' }}>
				<div className='flex flex-wrap items-center gap-2.5'>
					<span className='rounded-full bg-accent-bright px-3 py-1 font-heading text-[10.5px] font-black uppercase tracking-wide text-white'>
						Done for you
					</span>
					<span className='font-mono text-[11px] uppercase tracking-widest text-white/50'>
						Not automated
					</span>
				</div>
				<h2
					className='mt-3 font-heading font-black text-white'
					style={{ fontSize: 26, letterSpacing: -0.8 }}>
					Want me to test {host} myself?
				</h2>
				<p className='mt-2 max-w-2xl text-[14.5px] leading-relaxed text-white/60'>
					The scan above is automated and covers your homepage. If something important is on
					the line — a launch, a campaign, a checkout that has to work — I&apos;ll go through
					your site by hand and tell you everything that&apos;s wrong with it.
				</p>
			</div>

			<div className='grid gap-0 md:grid-cols-[1.1fr_1fr]'>
				<div className='border-b border-border-soft p-6 md:border-b-0 md:border-r md:p-7'>
					<div className='mb-4 flex items-baseline gap-2'>
						<span className='font-heading text-3xl font-black text-ink'>{PRICE}</span>
						<span className='text-[13.5px] text-muted-ink'>one-time · {TURNAROUND}</span>
					</div>
					<ul className='flex flex-col gap-2.5'>
						{[
							'Up to 10 key pages, tested by hand — not a scan',
							'Every flow a customer actually uses: forms, checkout, booking, navigation',
							'Tested on real mobile and desktop browsers',
							'A written report in plain language, with screenshots',
							'A 15-minute call to walk you through it',
							'9 years of professional QA experience behind it',
						].map((item) => (
							<li key={item} className='flex items-start gap-2.5 text-[14px] text-ink'>
								<span
									aria-hidden='true'
									className='mt-[7px] size-1.5 shrink-0 rounded-full bg-accent-bright'
								/>
								<span>{item}</span>
							</li>
						))}
					</ul>
					<p className='mt-5 text-[12.5px] leading-relaxed text-muted-ink'>
						Larger sites are quoted individually. Tell me what you have and I&apos;ll give you
						a straight answer — including if you don&apos;t need it.
					</p>
				</div>

				<div className='bg-surface-soft p-6 md:p-7'>
					{status === 'sent' ?
						<div className='flex h-full flex-col justify-center'>
							<div className='font-heading text-[19px] font-extrabold text-ink'>
								Thanks — I&apos;ve got it.
							</div>
							<p className='mt-2 text-[14px] leading-relaxed text-body'>
								I&apos;ll reply personally within one business day, usually sooner. If
								it&apos;s urgent, email{' '}
								<a
									href='mailto:contact@getqalaunch.com'
									className='font-semibold text-brand hover:underline'>
									contact@getqalaunch.com
								</a>
								.
							</p>
							<p className='mt-3 font-mono text-[12px] text-muted-ink'>— Waqas</p>
						</div>
					: !open ?
						<div className='flex h-full flex-col justify-center'>
							<p className='text-[14px] leading-relaxed text-body'>
								Tell me about your site and I&apos;ll come back to you personally — usually
								the same day.
							</p>
							<button
								type='button'
								onClick={() => setOpen(true)}
								className='mt-4 inline-flex items-center justify-center rounded-xl bg-slate-deep px-5 py-3 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:shadow-lg'>
								Request a manual audit →
							</button>
							<p className='mt-3 text-[12px] text-muted-ink'>
								No payment now. I&apos;ll confirm scope and price first.
							</p>
						</div>
					:	<form onSubmit={handleSubmit} className='flex flex-col gap-3'>
							<div>
								<label
									htmlFor='enq-name'
									className='mb-1 block text-[12px] font-bold uppercase tracking-wide text-muted-ink'>
									Your name
								</label>
								<input
									id='enq-name'
									name='name'
									required
									maxLength={120}
									autoComplete='name'
									className='w-full rounded-lg border border-border-soft bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20'
								/>
							</div>
							<div>
								<label
									htmlFor='enq-email'
									className='mb-1 block text-[12px] font-bold uppercase tracking-wide text-muted-ink'>
									Email
								</label>
								<input
									id='enq-email'
									name='email'
									type='email'
									required
									maxLength={160}
									autoComplete='email'
									className='w-full rounded-lg border border-border-soft bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20'
								/>
							</div>
							<div>
								<label
									htmlFor='enq-whatsapp'
									className='mb-1 block text-[12px] font-bold uppercase tracking-wide text-muted-ink'>
									WhatsApp <span className='font-medium normal-case'>(optional)</span>
								</label>
								<input
									id='enq-whatsapp'
									name='whatsapp'
									inputMode='tel'
									maxLength={40}
									placeholder='+1 555 000 0000'
									className='w-full rounded-lg border border-border-soft bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20'
								/>
							</div>
							<div>
								<label
									htmlFor='enq-concern'
									className='mb-1 block text-[12px] font-bold uppercase tracking-wide text-muted-ink'>
									What worries you most? <span className='font-medium normal-case'>(optional)</span>
								</label>
								<textarea
									id='enq-concern'
									name='concern'
									rows={3}
									maxLength={2000}
									placeholder='e.g. I am not sure my checkout works on phones'
									className='w-full resize-y rounded-lg border border-border-soft bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20'
								/>
							</div>

							<p className='text-[12px] text-muted-ink'>
								Site: <span className='font-mono text-ink'>{host}</span> — taken from this scan,
								no need to retype it.
							</p>

							{status === 'error' && error ?
								<p role='alert' className='text-[13px] font-semibold text-danger'>
									{error}
								</p>
							:	null}

							<button
								type='submit'
								disabled={status === 'sending'}
								className='mt-1 inline-flex items-center justify-center rounded-xl bg-slate-deep px-5 py-3 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60'>
								{status === 'sending' ? 'Sending…' : 'Send enquiry →'}
							</button>
							<p className='text-[12px] text-muted-ink'>
								Goes straight to my inbox. No payment now, no newsletter.
							</p>
						</form>
					}
				</div>
			</div>
		</div>
	);
}
