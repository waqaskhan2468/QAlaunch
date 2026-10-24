'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Search, UserRound } from 'lucide-react'

import { cn } from '@/lib/utils'

type Status = 'idle' | 'sending' | 'sent' | 'error'

/**
 * What to offer someone the moment the check finishes.
 *
 * This is the highest-intent second on the site: they typed their own address,
 * were told something specific about it, and are still looking at it. Two ways
 * forward, because the two audiences split cleanly here — people who want to
 * know more, and people who want someone else to deal with it.
 *
 * The form is deliberately three fields. The website is already known, so the
 * real ask is a name and an email. Everything past that costs conversions, and
 * the point is to start a conversation rather than collect a brief.
 *
 * What the checker already found travels with the enquiry so the reply can
 * open with their actual situation. They never type it and never see it asked
 * for.
 */
export function NextSteps({
	websiteUrl,
	detectedPhp,
	detectedHost,
}: {
	websiteUrl: string
	detectedPhp?: string | null
	detectedHost?: string | null
}) {
	const [open, setOpen] = useState(false)
	const [status, setStatus] = useState<Status>('idle')
	const [error, setError] = useState<string | null>(null)

	async function submit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault()
		if (status === 'sending') return

		const form = new FormData(e.currentTarget)
		const payload = {
			name: String(form.get('name') ?? '').trim(),
			email: String(form.get('email') ?? '').trim(),
			websiteUrl: String(form.get('websiteUrl') ?? '').trim(),
			need: String(form.get('need') ?? '').trim() || undefined,
			detectedPhp: detectedPhp ?? undefined,
			detectedHost: detectedHost ?? undefined,
			company: String(form.get('company') ?? ''),
		}

		if (!payload.name || !payload.email.includes('@') || !payload.websiteUrl) {
			setError('Please fill in your name, email and website.')
			return
		}

		setStatus('sending')
		setError(null)
		try {
			const res = await fetch('/api/expert-enquiry', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			})
			const data = (await res.json().catch(() => null)) as
				| { ok?: boolean; message?: string }
				| null

			if (!res.ok || !data?.ok) {
				setStatus('error')
				setError(data?.message ?? 'Something went wrong. Please try again.')
				return
			}
			setStatus('sent')
		} catch {
			setStatus('error')
			setError('Could not reach the server. Please try again.')
		}
	}

	if (status === 'sent') {
		return (
			<div className='mt-7 flex items-start gap-3 rounded-2xl border-2 border-accent-emerald/40 bg-accent-emerald/5 p-5'>
				<Check className='mt-0.5 size-5 shrink-0 text-accent-emerald' aria-hidden='true' />
				<div>
					<p className='text-[16px] font-bold text-ink'>Got it — we will be in touch.</p>
					<p className='mt-1 text-[14.5px] leading-relaxed text-body'>
						Your enquiry is with us along with what the check found on{' '}
						<strong className='text-ink'>{websiteUrl}</strong>, so we can reply with
						something useful rather than asking you to explain it again.
					</p>
				</div>
			</div>
		)
	}

	return (
		<div className='mt-7'>
			<h3 className='text-[13px] font-bold uppercase tracking-wider text-muted-ink'>
				What next
			</h3>

			<div className='mt-3 grid gap-3 sm:grid-cols-2'>
				<Link
					href={`/?utm_source=php_checker&utm_medium=result${
						websiteUrl ? `&url=${encodeURIComponent(websiteUrl)}` : ''
					}`}
					className='group flex flex-col rounded-xl border-2 border-border-soft bg-white p-4 transition hover:-translate-y-0.5 hover:border-brand'>
					<Search className='size-5 text-brand' aria-hidden='true' />
					<span className='mt-2.5 text-[15px] font-bold text-ink'>
						Get a full audit of your website
					</span>
					<span className='mt-1 text-[13.5px] leading-relaxed text-body'>
						We open your site in a real browser and test it the way a visitor would —
						broken links, forms that fail silently, mobile layout. Free for your homepage.
					</span>
				</Link>

				<button
					type='button'
					onClick={() => setOpen(true)}
					aria-expanded={open}
					className={cn(
						'group flex flex-col rounded-xl border-2 p-4 text-left transition hover:-translate-y-0.5',
						open ? 'border-brand bg-brand-pale' : 'border-border-soft bg-white hover:border-brand',
					)}>
					<UserRound className='size-5 text-brand' aria-hidden='true' />
					<span className='mt-2.5 text-[15px] font-bold text-ink'>
						Hire an expert to update your website
					</span>
					<span className='mt-1 text-[13.5px] leading-relaxed text-body'>
						Would rather someone just dealt with it? Leave your details and we will come
						back to you about getting it sorted.
					</span>
				</button>
			</div>

			{open ? (
				<form
					onSubmit={submit}
					className='relative mt-4 rounded-xl border-2 border-slate-deep bg-white p-5'>
					{/* Honeypot: off-screen, out of tab order, hidden from assistive tech. */}
					<div
						aria-hidden='true'
						className='absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden'>
						<label htmlFor='expert-company'>Company (leave this empty)</label>
						<input
							id='expert-company'
							name='company'
							type='text'
							tabIndex={-1}
							autoComplete='off'
							defaultValue=''
						/>
					</div>

					<p className='text-[15px] font-bold text-ink'>Tell us where to reach you</p>
					<p className='mt-1 text-[13px] leading-relaxed text-muted-ink'>
						Three fields. We already have your website from the check you just ran.
					</p>

					<div className='mt-4 grid gap-3 sm:grid-cols-2'>
						<Field label='Your name' htmlFor='expert-name'>
							<input
								id='expert-name'
								name='name'
								type='text'
								required
								autoComplete='name'
								className={inputClass}
							/>
						</Field>
						<Field label='Email' htmlFor='expert-email'>
							<input
								id='expert-email'
								name='email'
								type='email'
								required
								autoComplete='email'
								placeholder='you@yourbusiness.com'
								className={inputClass}
							/>
						</Field>
					</div>

					<div className='mt-3'>
						<Field label='Website' htmlFor='expert-website'>
							<input
								id='expert-website'
								name='websiteUrl'
								type='text'
								required
								defaultValue={websiteUrl}
								className={inputClass}
							/>
						</Field>
					</div>

					<div className='mt-3'>
						<Field label='What do you need help with?' htmlFor='expert-need' optional>
							<input
								id='expert-need'
								name='need'
								type='text'
								placeholder='Optional — e.g. "update PHP, I have no idea how"'
								className={inputClass}
							/>
						</Field>
					</div>

					<button
						type='submit'
						disabled={status === 'sending'}
						className='mt-4 inline-flex h-12 items-center justify-center rounded-xl bg-slate-deep px-6 text-[15px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60'>
						{status === 'sending' ? 'Sending…' : 'Send my details'}
					</button>

					{error ? (
						<p role='alert' className='mt-3 text-[13.5px] font-semibold text-red-600'>
							{error}
						</p>
					) : null}

					<p className='mt-3 text-[12px] leading-relaxed text-muted-ink'>
						We use this to reply to you about your website and nothing else.
					</p>
				</form>
			) : null}
		</div>
	)
}

const inputClass =
	'h-11 w-full rounded-lg border-2 border-border-soft bg-white px-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-muted-ink focus:border-brand'

function Field({
	label,
	htmlFor,
	optional,
	children,
}: {
	label: string
	htmlFor: string
	optional?: boolean
	children: React.ReactNode
}) {
	return (
		<div>
			<label htmlFor={htmlFor} className='mb-1 block text-[13px] font-bold text-ink'>
				{label}
				{optional ? <span className='font-normal text-muted-ink'> (optional)</span> : null}
			</label>
			{children}
		</div>
	)
}
