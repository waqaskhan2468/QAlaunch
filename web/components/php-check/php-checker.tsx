'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Check, Info, Search, X } from 'lucide-react'

import type { DetectResult } from '@/lib/php-check/detect'
import { hostForPlatform } from '@/lib/php-check/hosts'
import { PHP2SHELL, verdictHeadline } from '@/lib/php-check/php-versions'
import { cn } from '@/lib/utils'

type State =
	| { s: 'idle' }
	| { s: 'checking' }
	| { s: 'blocked'; status: number }
	| { s: 'error'; message: string }
	| { s: 'done'; result: DetectResult }

/**
 * The free, ungated check.
 *
 * Ungated on purpose. The pages winning this search are tool pages that give
 * an answer immediately, and a gated tool cannot be cited by an AI assistant —
 * which is the one advantage a small site has over Wordfence's domain
 * authority here. The email ask belongs on the full scan underneath, after
 * this has already given something away.
 *
 * Every string in here obeys one rule: describe what the server reported and
 * what the advisory says, never assert that the reader's site is vulnerable.
 * A PHP banner cannot establish that, because distributions backport fixes
 * without changing the version string.
 */
export function PhpChecker() {
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
					aria-label='Your website address'
					autoComplete='url'
					className='h-13 min-w-0 flex-1 rounded-xl border-2 border-border-soft px-4 text-[16px] text-ink outline-none transition-colors placeholder:text-muted-ink focus:border-brand'
				/>
				<button
					type='submit'
					disabled={state.s === 'checking'}
					className='inline-flex h-13 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-deep px-6 text-[15px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60'>
					<Search className='size-4' aria-hidden='true' />
					{state.s === 'checking' ? 'Checking…' : 'Check my site'}
				</button>
			</form>

			<p className='mt-2.5 text-[12.5px] leading-relaxed text-muted-ink'>
				No signup. We load your homepage once — the same single request any visitor
				makes — and report what it tells us. Nothing else on your site is touched.
			</p>

			{state.s === 'error' && (
				<p role='alert' className='mt-4 text-[14px] font-semibold text-red-600'>
					{state.message}
				</p>
			)}

			{state.s === 'blocked' && (
				<Panel tone='neutral' icon={<Info className='size-4' />}>
					<p className='font-bold text-ink'>Your site blocked the check (HTTP {state.status}).</p>
					<p className='mt-1.5 text-body'>
						That usually means a firewall or CDN is screening automated requests, which is
						a reasonable thing for it to do. We do not try to get around it. You can read
						your PHP version yourself in WordPress under{' '}
						<strong>Tools → Site Health → Info → Server</strong>.
					</p>
				</Panel>
			)}

			{state.s === 'done' && <Result result={state.result} />}
		</div>
	)
}

function Panel({
	tone,
	icon,
	children,
}: {
	tone: 'good' | 'warn' | 'neutral'
	icon: React.ReactNode
	children: React.ReactNode
}) {
	return (
		<div
			className={cn(
				'mt-5 flex gap-3 rounded-xl border-2 p-4 text-[14px] leading-relaxed',
				tone === 'good' && 'border-accent-emerald/40 bg-accent-emerald/5',
				tone === 'warn' && 'border-amber-400/50 bg-amber-50',
				tone === 'neutral' && 'border-border-soft bg-surface-soft',
			)}>
			<div
				className={cn(
					'mt-0.5 shrink-0',
					tone === 'good' && 'text-accent-emerald',
					tone === 'warn' && 'text-amber-600',
					tone === 'neutral' && 'text-muted-ink',
				)}>
				{icon}
			</div>
			<div className='min-w-0'>{children}</div>
		</div>
	)
}

function Result({ result }: { result: DetectResult }) {
	const { phpVerdict, phpVersionDetected, platform, wordpress, securityHeaders } = result
	const missing = securityHeaders.filter((h) => !h.present)

	return (
		<div>
			{/* ── The PHP answer ─────────────────────────────────────────── */}
			{phpVerdict.kind === 'unknown' ?
				<Panel tone='neutral' icon={<Info className='size-4' />}>
					<p className='font-bold text-ink'>
						Your server does not publish its PHP version — and that is normal.
					</p>
					<p className='mt-1.5 text-body'>
						Most hosts hide it deliberately, because telling the internet which version
						you run is itself a small risk. In a sample of twenty WordPress sites we
						checked, only one published it. So this is a good sign, not a failure.
					</p>
					{platform ?
						<p className='mt-2.5 text-body'>
							Your site is served by <strong className='text-ink'>{platform}</strong>.{' '}
							{hostForPlatform(platform) ?
								<>
									We track what they have publicly said about the October 2026 PHP
									release —{' '}
									<Link
										href={`/php/host/${hostForPlatform(platform)!.slug}`}
										className='font-semibold text-brand hover:underline'>
										see {hostForPlatform(platform)!.name}&rsquo;s status
									</Link>
									.
								</>
							:	<>
									Managed hosts generally patched their own fleets for the October 2026
									PHP release — check {platform}&rsquo;s status page or support to
									confirm the date.
								</>}
						</p>
					:	null}
					<p className='mt-2.5 text-body'>
						To read it yourself: in WordPress go to{' '}
						<strong className='text-ink'>Tools → Site Health → Info → Server</strong>. No
						cPanel, FTP or SSH needed.
					</p>
				</Panel>
			: phpVerdict.kind === 'patched' ?
				<Panel tone='good' icon={<Check className='size-4' />}>
					<p className='font-bold text-ink'>{verdictHeadline(phpVerdict, phpVersionDetected)}</p>
				</Panel>
			:	<Panel tone='warn' icon={<AlertTriangle className='size-4' />}>
					<p className='font-bold text-ink'>{verdictHeadline(phpVerdict, phpVersionDetected)}</p>
					<p className='mt-2 text-body'>
						This is worth checking, not panicking about. Debian, Ubuntu and Red Hat all
						apply security fixes without changing the version number, so a server can
						report {phpVersionDetected} and still be patched. The reliable answer comes
						from your host.
					</p>
				</Panel>
			}

			{/* ── What else the single request showed ────────────────────── */}
			<div className='mt-6'>
				<h3 className='text-[13px] font-bold uppercase tracking-wider text-muted-ink'>
					What else that one request told us
				</h3>

				<dl className='mt-3 divide-y divide-border-soft border-y border-border-soft'>
					<Row
						label='WordPress'
						value={wordpress.detected ? 'Detected' : 'Not detected'}
						note={wordpress.evidence[0] ?? 'No WordPress signals in the page or headers.'}
					/>
					<Row
						label='HTTPS'
						value={result.servedOverHttps ? 'Yes' : 'No'}
						note={
							result.servedOverHttps ?
								'Your site is served over an encrypted connection.'
							:	'Your site answered over plain HTTP. Anything a visitor types can be read in transit.'
						}
						bad={!result.servedOverHttps}
					/>
					{result.xmlrpcAdvertised ? (
						<Row
							label='XML-RPC'
							value='Advertised'
							note='Your server advertises XML-RPC in its headers. It is a common target for automated login attempts, and most sites no longer need it.'
						/>
					) : null}
					{platform ? <Row label='Hosting' value={platform} note='Read from your response headers.' /> : null}
				</dl>
			</div>

			{/* ── Security headers ───────────────────────────────────────── */}
			<div className='mt-6'>
				<h3 className='text-[13px] font-bold uppercase tracking-wider text-muted-ink'>
					Security headers — {securityHeaders.length - missing.length} of{' '}
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

			<div className='mt-7 rounded-xl bg-slate-deep p-5'>
				<p className='text-[15px] font-bold text-white'>
					This read one page. Your site is bigger than that.
				</p>
				<p className='mt-1.5 text-[14px] leading-relaxed text-white/70'>
					A full scan opens your site in a real browser and checks every page you choose —
					broken links, forms that fail silently, mobile layout, and the configuration
					findings above across the whole site, with a screenshot of each one.
				</p>
				<Link
					href='/?utm_source=php_checker'
					className='mt-4 inline-flex items-center justify-center rounded-xl bg-accent-bright px-5 py-2.5 text-[14px] font-extrabold text-white transition hover:-translate-y-0.5'>
					Run a free full scan →
				</Link>
			</div>

			<p className='mt-4 text-[12px] leading-relaxed text-muted-ink'>
				This check reads one response. It cannot see your files, your database, your
				plugins or your users, so it cannot tell you whether a site has been broken into
				— no external checker can. Advisory details: {PHP2SHELL.cves.join(' and ')}, CVSS{' '}
				{PHP2SHELL.cvss}, published {PHP2SHELL.disclosed}.
			</p>
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
			<dt className='w-36 shrink-0 text-[13px] font-bold text-muted-ink'>{label}</dt>
			<dd className='min-w-0 text-[14px] leading-relaxed'>
				<span className={cn('font-bold', bad ? 'text-amber-700' : 'text-ink')}>{value}</span>
				<span className='text-body'> — {note}</span>
			</dd>
		</div>
	)
}
