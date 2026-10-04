'use client';

import { useState } from 'react';
import { Check, Mail } from 'lucide-react';

import { cn } from '@/lib/utils';

type Status = 'idle' | 'sending' | 'done' | 'error';

/**
 * Optional "email me the results" prompt on the result page.
 *
 * Shown twice, in two different moments:
 *
 * - `waiting` — while the scan runs. It takes about two minutes, and people
 *   paste a URL, switch tabs and never come back. Offering to send the link is
 *   genuinely useful to them, which is why it is worth asking at all.
 * - `done` — once results are on screen, when they have seen that the thing
 *   works. Asking after delivering something converts far better than gating
 *   it beforehand.
 *
 * Deliberately not a gate. The scan runs and the results display whether or
 * not this is touched. "No signup" is promised in the site metadata, in
 * llms.txt, and on the ad creatives currently running, and all three have to
 * stay true.
 *
 * The consent box is separate from the address and starts unticked: asking for
 * your own report is not agreeing to be marketed to. Canada's CASL and the UK
 * rules both turn on that distinction, and getting it right now is what makes
 * the list usable later.
 */
export function ResultEmailCapture({
	scanId,
	variant,
	className,
}: {
	scanId: string | null;
	variant: 'waiting' | 'done';
	className?: string;
}) {
	const [email, setEmail] = useState('');
	const [consent, setConsent] = useState(false);
	const [company, setCompany] = useState(''); // honeypot
	const [status, setStatus] = useState<Status>('idle');
	const [error, setError] = useState<string | null>(null);

	if (!scanId) return null;

	const copy =
		variant === 'waiting' ?
			{
				heading: 'This takes about two minutes',
				body: 'Want the link emailed to you when it is ready? You can close this tab.',
				button: 'Email it to me',
				doneText: 'Done. We will email you the moment it finishes.',
			}
		:	{
				heading: 'Want a copy in your inbox?',
				body: 'We will send these results so you can come back to them, or forward them on.',
				button: 'Send it to me',
				doneText: 'Sent. Check your inbox in a minute or two.',
			};

	async function submit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (status === 'sending') return;

		const trimmed = email.trim();
		if (!trimmed || !trimmed.includes('@')) {
			setError('Enter a valid email address.');
			return;
		}

		setStatus('sending');
		setError(null);
		try {
			const res = await fetch('/api/scan/notify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ scanId, email: trimmed, consent, company }),
			});
			const data = (await res.json().catch(() => null)) as
				| { ok?: boolean; message?: string }
				| null;

			if (!res.ok || !data?.ok) {
				setStatus('error');
				setError(data?.message ?? 'Could not save that. Please try again.');
				return;
			}
			setStatus('done');
		} catch {
			setStatus('error');
			setError('Could not reach the server. Please try again.');
		}
	}

	if (status === 'done') {
		return (
			<div
				className={cn(
					'flex items-center gap-2.5 rounded-xl border-2 border-accent-emerald/40 bg-accent-emerald/5 px-4 py-3.5',
					className,
				)}>
				<Check className='size-4 shrink-0 text-accent-emerald' aria-hidden='true' />
				<p className='text-[14px] font-semibold text-ink'>{copy.doneText}</p>
			</div>
		);
	}

	return (
		<form
			onSubmit={submit}
			className={cn(
				'relative rounded-xl border-2 border-border-soft bg-white px-4 py-4',
				className,
			)}>
			{/* Honeypot: off-screen, out of tab order, hidden from assistive tech. */}
			<div
				aria-hidden='true'
				className='absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden'>
				<label htmlFor={`notify-company-${variant}`}>Company (leave this empty)</label>
				<input
					id={`notify-company-${variant}`}
					name='company'
					type='text'
					tabIndex={-1}
					autoComplete='off'
					value={company}
					onChange={(e) => setCompany(e.target.value)}
				/>
			</div>

			<div className='mb-1 flex items-center gap-2'>
				<Mail className='size-4 shrink-0 text-brand' aria-hidden='true' />
				<p className='text-[14.5px] font-bold text-ink'>{copy.heading}</p>
			</div>
			<p className='mb-3 text-[13px] leading-relaxed text-muted-ink'>{copy.body}</p>

			<div className='flex flex-col gap-2 sm:flex-row'>
				<input
					type='email'
					inputMode='email'
					autoComplete='email'
					placeholder='you@yourbusiness.com'
					aria-label='Your email address'
					value={email}
					onChange={(e) => {
						setEmail(e.target.value);
						if (error) setError(null);
					}}
					className='h-11 min-w-0 flex-1 rounded-lg border-2 border-border-soft bg-white px-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-muted-ink focus:border-brand'
				/>
				<button
					type='submit'
					disabled={status === 'sending'}
					className='h-11 shrink-0 rounded-lg bg-slate-deep px-5 text-[14.5px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60'>
					{status === 'sending' ? 'Sending…' : copy.button}
				</button>
			</div>

			<label className='mt-3 flex cursor-pointer items-start gap-2.5'>
				<input
					type='checkbox'
					checked={consent}
					onChange={(e) => setConsent(e.target.checked)}
					className='mt-0.5 size-4 shrink-0 cursor-pointer accent-brand'
				/>
				<span className='text-[12.5px] leading-relaxed text-muted-ink'>
					Also send me the occasional tip on keeping my site working. No more than
					once a month, and you can stop any time.
				</span>
			</label>

			{error ? (
				<p role='alert' className='mt-2.5 text-[13px] font-semibold text-red-600'>
					{error}
				</p>
			) : null}
		</form>
	);
}
