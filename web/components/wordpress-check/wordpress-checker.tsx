'use client'

import { useState } from 'react'
import { AlertTriangle, Check, Info, Search, X } from 'lucide-react'

import type { DetectResult } from '@/lib/php-check/detect'
import { hostForPlatform } from '@/lib/php-check/hosts'
import { NextSteps } from '@/components/php-check/next-steps'
import { cn } from '@/lib/utils'
import Link from 'next/link'

type State =
	| { s: 'idle' }
	| { s: 'checking' }
	| { s: 'blocked'; status: number }
	| { s: 'error'; message: string }
	| { s: 'done'; result: DetectResult }

/**
 * "Is this site WordPress, and what can I tell about it?"
 *
 * Search Console says this demand already exists and lands badly: "wordpress
 * checker" sits at position 9.4, "is this site wordpress" at 31.9, "wordpress
 * site analysis" at 33.3 — roughly 600 impressions a quarter of real intent,
 * almost all of it converting to nothing because it currently arrives on a
 * landing page rather than something that answers the question.
 *
 * The same data shows the shape that works: /php-version-checker, which gives
 * an instant answer from one request, earns 6.17% CTR at position 7.8, while
 * the landing pages sit near 1.8%. People searching this want a thing that
 * does something.
 *
 * Reuses /api/php-check unchanged — one request to the homepage, nothing
 * probed, nothing submitted. The detection comes from what the page already
 * publishes about itself.
 */
export function WordPressChecker() {
	const [url, setUrl] = useState('')
	const [state, setState] = useState<State>({ s: 'idle' })

	async function run(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault()
		const value = url.trim()
		if (!value) return

		setState({ s: 'checking' })
		try {
			const res = await fetch('/api/php-check', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: value }),
			})
			const data = await res.json()

			if (!res.ok || !data?.ok) {
				setState({ s: 'error', message: data?.message ?? 'Something went wrong.' })
				return
			}
			if (data.blocked) {
				setState({ s: 'blocked', status: data.httpStatus })
				return
			}
			setState({ s: 'done', result: data.result as DetectResult })
		} catch {
			setState({ s: 'error', message: 'Could not reach the server. Please try again.' })
		}
	}

	return (
		<div className='rounded-2xl border-2 border-slate-deep bg-white p-5 shadow-sm md:p-7'>
			<form onSubmit={run} className='flex flex-col gap-2.5 sm:flex-row'>
				<input
					value={url}
					onChange={(e) => setUrl(e.target.value)}
					placeholder='yourwebsite.com'
					aria-label='Website address to check'
					autoComplete='url'
					className='h-13 min-w-0 flex-1 rounded-xl border-2 border-border-soft px-4 text-[16px] text-ink outline-none transition-colors placeholder:text-muted-ink focus:border-brand'
				/>
				<button
					type='submit'
					disabled={state.s === 'checking'}
					className='inline-flex h-13 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-deep px-6 text-[15px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60'>
					<Search className='size-4' aria-hidden='true' />
					{state.s === 'checking' ? 'Checking…' : 'Check this site'}
				</button>
			</form>

			<p className='mt-2.5 text-[12.5px] leading-relaxed text-muted-ink'>
				No signup. We load the homepage once — the same single request any visitor makes —
				and report what it tells us. Nothing else on the site is touched.
			</p>

			{state.s === 'error' && (
				<p role='alert' className='mt-4 text-[14px] font-semibold text-red-600'>
					{state.message}
				</p>
			)}

			{state.s === 'blocked' && (
				<div className='mt-5 flex gap-3 rounded-xl border-2 border-border-soft bg-surface-soft p-4 text-[14px] leading-relaxed'>
					<Info className='mt-0.5 size-4 shrink-0 text-muted-ink' aria-hidden='true' />
					<div>
						<p className='font-bold text-ink'>That site blocked the check (HTTP {state.status}).</p>
						<p className='mt-1.5 text-body'>
							Usually a firewall or CDN screening automated requests, which is reasonable
							of it. We do not try to get around that.
						</p>
					</div>
				</div>
			)}

			{state.s === 'done' && <Result result={state.result} />}
		</div>
	)
}

function Result({ result }: { result: DetectResult }) {
	const { wordpress, platform, securityHeaders, servedOverHttps } = result
	const host = platform ? hostForPlatform(platform) : null

	return (
		<div>
			{wordpress.detected ?
				<div className='mt-5 flex gap-3 rounded-xl border-2 border-accent-emerald/40 bg-accent-emerald/5 p-4'>
					<Check className='mt-0.5 size-5 shrink-0 text-accent-emerald' aria-hidden='true' />
					<div className='min-w-0'>
						<p className='text-[16px] font-bold text-ink'>
							Yes — this is a WordPress site
							{wordpress.version ? `, running WordPress ${wordpress.version}` : ''}.
						</p>
						<ul className='mt-2 flex flex-col gap-1 text-[14px] leading-relaxed text-body'>
							{wordpress.evidence.map((e) => (
								<li key={e}>· {e}</li>
							))}
						</ul>
						{!wordpress.version ? (
							<p className='mt-2.5 text-[13.5px] leading-relaxed text-muted-ink'>
								The version is not published. Most security plugins strip that tag
								deliberately, so its absence is a good sign rather than a missing answer.
							</p>
						) : null}
					</div>
				</div>
			:	<div className='mt-5 flex gap-3 rounded-xl border-2 border-border-soft bg-surface-soft p-4'>
					<X className='mt-0.5 size-5 shrink-0 text-muted-ink' aria-hidden='true' />
					<div className='min-w-0'>
						<p className='text-[16px] font-bold text-ink'>
							No WordPress signals found on this page.
						</p>
						<p className='mt-1.5 text-[14px] leading-relaxed text-body'>
							We look for the generator tag, files loaded from /wp-content/ and
							/wp-includes/, an X-Pingback header and the WordPress REST API. None
							appeared. That usually means it is not WordPress — though a heavily
							customised or cached site can hide all five, so this is evidence rather
							than proof.
						</p>
						{platform ? (
							<p className='mt-2.5 text-[14px] leading-relaxed text-body'>
								It is served by <strong className='text-ink'>{platform}</strong>.
							</p>
						) : null}
					</div>
				</div>
			}

			<div className='mt-6'>
				<h3 className='text-[13px] font-bold uppercase tracking-wider text-muted-ink'>
					What else that one request told us
				</h3>
				<dl className='mt-3 divide-y divide-border-soft border-y border-border-soft'>
					<Row
						label='HTTPS'
						value={servedOverHttps ? 'Yes' : 'No'}
						note={
							servedOverHttps ?
								'Served over an encrypted connection.'
							:	'Answered over plain HTTP. Anything a visitor types can be read in transit.'
						}
						bad={!servedOverHttps}
					/>
					{platform ? (
						<Row
							label='Hosting'
							value={platform}
							note={
								host ?
									'We track what they have published about recent PHP security releases.'
								:	'Read from the response headers.'
							}
						/>
					) : null}
					{result.xmlrpcAdvertised ? (
						<Row
							label='XML-RPC'
							value='Advertised'
							note='A common target for automated login attempts, and most sites no longer need it.'
						/>
					) : null}
					{result.phpVersionDetected ? (
						<Row
							label='PHP'
							value={result.phpVersionDetected}
							note='The version the server prints. Hosts often patch without changing it.'
						/>
					) : null}
				</dl>
				{host ? (
					<p className='mt-3 text-[13.5px] text-body'>
						<Link
							href={`/php/host/${host.slug}`}
							className='font-semibold text-brand hover:underline'>
							See what {host.name} has said about the October 2026 PHP release →
						</Link>
					</p>
				) : null}
			</div>

			<div className='mt-6'>
				<h3 className='text-[13px] font-bold uppercase tracking-wider text-muted-ink'>
					Security headers — {securityHeaders.filter((h) => h.present).length} of{' '}
					{securityHeaders.length} present
				</h3>
				<ul className='mt-3 flex flex-col gap-2'>
					{securityHeaders.map((h) => (
						<li key={h.id} className='flex gap-2.5 text-[14px] leading-relaxed'>
							{h.present ?
								<Check className='mt-0.5 size-4 shrink-0 text-accent-emerald' aria-hidden='true' />
							:	<X className='mt-0.5 size-4 shrink-0 text-muted-ink' aria-hidden='true' />}
							<span className='min-w-0'>
								<strong className={cn('font-bold', h.present ? 'text-ink' : 'text-body')}>
									{h.label}
								</strong>
								<span className='text-body'> — {h.detail}</span>
							</span>
						</li>
					))}
				</ul>
			</div>

			<div className='mt-6 flex gap-3 rounded-xl border-2 border-amber-400/40 bg-amber-50 p-4'>
				<AlertTriangle className='mt-0.5 size-4 shrink-0 text-amber-600' aria-hidden='true' />
				<p className='text-[13.5px] leading-relaxed text-body'>
					This read one page from the outside. It cannot see your plugins, your theme
					files, your database or your users — so it cannot tell you why an update broke
					something, or whether a site has been broken into. A full scan opens the site in
					a real browser and tests it the way a visitor does, which is a different and much
					longer answer.
				</p>
			</div>

			<NextSteps
				websiteUrl={result.finalUrl}
				detectedPhp={result.phpVersionDetected}
				detectedHost={platform}
			/>
		</div>
	)
}

function Row({
	label,
	value,
	note,
	bad,
}: {
	label: string
	value: string
	note: string
	bad?: boolean
}) {
	return (
		<div className='flex flex-col gap-0.5 py-3 sm:flex-row sm:gap-4'>
			<dt className='w-32 shrink-0 text-[13px] font-bold text-muted-ink'>{label}</dt>
			<dd className='min-w-0 text-[14px] leading-relaxed'>
				<span className={cn('font-bold', bad ? 'text-amber-700' : 'text-ink')}>{value}</span>
				<span className='text-body'> — {note}</span>
			</dd>
		</div>
	)
}
