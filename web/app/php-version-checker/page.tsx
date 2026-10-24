import type { Metadata } from 'next'
import Link from 'next/link'

import { PhpChecker } from '@/components/php-check/php-checker'
import { SiteFooter } from '@/components/site/site-footer'
import { SiteNav } from '@/components/site/site-nav'
import { FIXED_IN, PHP2SHELL } from '@/lib/php-check/php-versions'
import { faqPageSchema, jsonLd, SITE_URL } from '@/lib/seo/structured-data'

/**
 * PHP version checker.
 *
 * Why this page exists, and why it is not the page that was originally asked
 * for. Google Trends over the week of the October 2026 PHP release: the query
 * "php version check" went up roughly 11-30x against its own twelve-month
 * baseline, while "wordpress hacked" and "is my website hacked" did not move
 * at all. The event did not create hack-panic demand. It created
 * version-verification demand, and those are different people.
 *
 * The head terms for security scanning belong to Wordfence, Sucuri, Patchstack
 * and WPScan and are not winnable. The PHP-version SERP has no major brand on
 * it at all — the strongest thing there is a GoDaddy knowledge-base article.
 *
 * Two deliberate choices:
 *
 * 1. The tool is ungated. The pages that win this query answer immediately,
 *    and a gated tool cannot be cited by an AI assistant, which is the one
 *    advantage a low-authority site has here. The email ask lives on the full
 *    scan, after this has already given something away.
 * 2. The page states its own hit rate. We read a PHP version from roughly one
 *    site in twenty. Every competitor hides this; none of them tell you what
 *    to do about the other nineteen. Being the only honest source on a
 *    question is the cheapest citation available.
 */

const LAST_REVIEWED = '2026-10-24'

export const metadata: Metadata = {
	alternates: { canonical: '/php-version-checker' },
	title: 'PHP Version Checker — Check Any Website Online, Free',
	description:
		'Check what PHP version a website runs, and whether that release predates the October 2026 security fix. Free, no signup. Plus what to do when a host hides it — which is most of the time.',
	openGraph: {
		title: 'PHP Version Checker — Check Any Website Online',
		description:
			'Find out what PHP version a site reports, and whether it predates the October 2026 fix. Free, no signup, one request.',
		url: `${SITE_URL}/php-version-checker`,
	},
}

const FAQS = [
	{
		q: 'How do I check the PHP version of a website?',
		a: 'Paste the address into the checker above. We load the homepage once and read the PHP version from the server response headers, if the server publishes it. Most do not, so if nothing comes back the reliable method is inside WordPress itself: Tools → Site Health → Info → Server shows your PHP version with no cPanel, FTP or SSH access needed.',
	},
	{
		q: 'Why can you not see my PHP version?',
		a: 'Because your host hides it, which is the correct thing for them to do. Publishing your exact PHP version tells anyone who asks which vulnerabilities to try. In a sample of twenty WordPress sites we tested, only one published its version. A blank result here is a good sign about your configuration, not a failure of the check.',
	},
	{
		q: 'Which PHP version fixed the October 2026 vulnerability?',
		a: `The fix shipped in PHP ${FIXED_IN['8.5']}, ${FIXED_IN['8.4']}, ${FIXED_IN['8.3']} and ${FIXED_IN['8.2']}, released 22 October 2026. The advisories are ${PHP2SHELL.cves[0]} and ${PHP2SHELL.cves[1]}, both rated CVSS ${PHP2SHELL.cvss} Critical. PHP branches older than 8.2 receive no security updates at all, so no patch level on them is current.`,
	},
	{
		q: 'Does WordPress need updating for this?',
		a: 'No. WordPress published on 21 October 2026 that no WordPress update is required or planned for these issues. The flaw is in PHP itself, which is the software your host runs underneath WordPress, so the fix comes from your host or your server administrator rather than from a WordPress update.',
	},
	{
		q: 'My site reports an old PHP version. Is my site vulnerable?',
		a: 'Not necessarily, and anyone who tells you otherwise from outside your server is guessing. Debian, Ubuntu and Red Hat all apply security fixes to older releases without changing the version number, so a server can report PHP 8.3.8 and already have the fix applied. The version string tells you what was printed, not what was patched. Ask your host, or check your control panel.',
	},
	{
		q: 'Can you tell me if my website has been hacked?',
		a: 'No, and neither can any other checker that works from outside your site. Reading one page tells us nothing about your files, your database, your plugins or your user accounts, which is where a compromise actually lives. Tools that genuinely detect a break-in — Wordfence and Patchstack among them — run installed on the site for exactly this reason.',
	},
	{
		q: 'How do I update my PHP version?',
		a: 'Almost always through your hosting control panel rather than through WordPress. On cPanel it is usually under "MultiPHP Manager" or "Select PHP Version". Managed hosts such as WP Engine, Kinsta and SiteGround have a PHP version setting in their own dashboard. Take a backup first, then move up one minor version at a time and check the site after each step, because very old plugins occasionally break on newer PHP.',
	},
	{
		q: 'Is this check safe to run on a site I do not own?',
		a: 'It makes exactly one request to the address you type — the same single page load any visitor makes — and reads what that response volunteered. It does not request hidden paths, submit anything, try passwords, or attempt to get around a firewall. If a site blocks the request we report that it blocked us and stop.',
	},
]

const BRANCHES = ['8.5', '8.4', '8.3', '8.2'] as const

export default function Page() {
	const faqSchema = faqPageSchema(FAQS)

	const appSchema = {
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: 'PHP Version Checker',
		url: `${SITE_URL}/php-version-checker`,
		applicationCategory: 'SecurityApplication',
		operatingSystem: 'Web',
		browserRequirements: 'Requires JavaScript',
		description:
			'Checks what PHP version a website reports and whether that release predates the October 2026 security fix.',
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
		creator: { '@type': 'Organization', name: 'QAlaunch', url: SITE_URL },
		dateModified: LAST_REVIEWED,
	}

	return (
		<>
			<script
				type='application/ld+json'
				dangerouslySetInnerHTML={{ __html: jsonLd(faqSchema) }}
			/>
			<script
				type='application/ld+json'
				dangerouslySetInnerHTML={{ __html: jsonLd(appSchema) }}
			/>

			<SiteNav />

			<main className='mx-auto max-w-3xl px-5 pb-24 pt-10 md:px-8 md:pt-14'>
				<p className='font-mono text-[11px] font-bold uppercase tracking-[2.5px] text-brand'>
					Free tool · no signup
				</p>
				<h1 className='mt-3 font-heading text-[34px] font-black leading-[1.15] tracking-tight text-ink md:text-[44px]'>
					What PHP version is this website running?
				</h1>

				{/* The answer up front, in one extractable paragraph. LLMs lift
				    self-contained sentences, not arguments. */}
				<p className='mt-4 text-[17px] leading-relaxed text-body'>
					Paste an address below to see what PHP version the server reports, and whether
					that release predates the October 2026 security fix. The fix shipped in PHP{' '}
					<strong className='text-ink'>{FIXED_IN['8.5']}</strong>,{' '}
					<strong className='text-ink'>{FIXED_IN['8.4']}</strong>,{' '}
					<strong className='text-ink'>{FIXED_IN['8.3']}</strong> and{' '}
					<strong className='text-ink'>{FIXED_IN['8.2']}</strong>, released 22 October 2026,
					for {PHP2SHELL.cves[0]} and {PHP2SHELL.cves[1]} (CVSS {PHP2SHELL.cvss}, Critical).
					WordPress itself needs no update — the fix comes from your host.
				</p>

				<div className='mt-7'>
					<PhpChecker />
				</div>

				{/* ── The honest bit, placed high on purpose ─────────────── */}
				<section className='mt-14'>
					<h2 className='font-heading text-[26px] font-black tracking-tight text-ink'>
						This works about one time in twenty. Here is why.
					</h2>
					<p className='mt-3 text-[16px] leading-relaxed text-body'>
						A remote checker can only read a PHP version if the server chooses to print
						one. We tested twenty WordPress sites: <strong className='text-ink'>one</strong>{' '}
						published a PHP version. Nine published their hosting platform and nothing
						more. The other ten published nothing at all.
					</p>
					<p className='mt-3 text-[16px] leading-relaxed text-body'>
						That is not a flaw in the tool, it is hosts doing the right thing. Announcing
						your exact PHP version tells anyone who asks which attacks to try, so well
						configured servers suppress it. If this page comes back empty for your site,
						that is mildly good news.
					</p>
					<p className='mt-3 text-[16px] leading-relaxed text-body'>
						So here is the method that works every time, with no cPanel, FTP or SSH:
					</p>
					<ol className='mt-4 flex list-decimal flex-col gap-2 pl-5 text-[16px] leading-relaxed text-body marker:font-bold marker:text-brand'>
						<li>Log in to WordPress.</li>
						<li>
							Go to <strong className='text-ink'>Tools → Site Health</strong>.
						</li>
						<li>
							Open the <strong className='text-ink'>Info</strong> tab.
						</li>
						<li>
							Expand <strong className='text-ink'>Server</strong>. Your PHP version is the
							first line.
						</li>
					</ol>
				</section>

				{/* ── The version matrix. Tables extract cleanly. ────────── */}
				<section className='mt-14'>
					<h2 className='font-heading text-[26px] font-black tracking-tight text-ink'>
						Which PHP versions have the October 2026 fix
					</h2>
					<div className='mt-4 overflow-x-auto'>
						<table className='w-full border-collapse text-[15px]'>
							<thead>
								<tr className='border-b-2 border-slate-deep text-left'>
									<th className='py-2.5 pr-4 font-bold text-ink'>Branch</th>
									<th className='py-2.5 pr-4 font-bold text-ink'>Fixed in</th>
									<th className='py-2.5 font-bold text-ink'>Status</th>
								</tr>
							</thead>
							<tbody>
								{BRANCHES.map((b) => (
									<tr key={b} className='border-b border-border-soft'>
										<td className='py-2.5 pr-4 font-mono font-semibold text-ink'>PHP {b}</td>
										<td className='py-2.5 pr-4 font-mono text-body'>{FIXED_IN[b]}</td>
										<td className='py-2.5 text-body'>Supported, security updates active</td>
									</tr>
								))}
								<tr className='border-b border-border-soft'>
									<td className='py-2.5 pr-4 font-mono font-semibold text-ink'>8.1 and older</td>
									<td className='py-2.5 pr-4 text-body'>—</td>
									<td className='py-2.5 text-body'>
										<strong className='text-amber-700'>End of life.</strong> No security
										updates at all, so no patch level is current.
									</td>
								</tr>
							</tbody>
						</table>
					</div>
					<p className='mt-3 text-[14px] leading-relaxed text-muted-ink'>
						Source: the PHP project&rsquo;s own advisories{' '}
						<span className='font-mono'>{PHP2SHELL.advisories[0]}</span> and{' '}
						<span className='font-mono'>{PHP2SHELL.advisories[1]}</span>, and the php.net
						changelog. Last reviewed {LAST_REVIEWED}.
					</p>
				</section>

				{/* ── What this cannot do ────────────────────────────────── */}
				<section className='mt-14'>
					<h2 className='font-heading text-[26px] font-black tracking-tight text-ink'>
						What this check cannot tell you
					</h2>
					<p className='mt-3 text-[16px] leading-relaxed text-body'>
						It cannot tell you whether your site has been broken into. Nor can any other
						checker that works from the outside, whatever its marketing says. One page
						load reveals nothing about your files, your database, your plugins or your
						user accounts, and that is where a compromise actually lives. The tools that
						genuinely detect one — Wordfence and Patchstack among them — run installed on
						the site, which is the whole reason they work that way.
					</p>
					<p className='mt-3 text-[16px] leading-relaxed text-body'>
						It also cannot confirm that you are patched. Debian, Ubuntu and Red Hat apply
						security fixes to older releases without changing the version number, so a
						server reporting PHP 8.3.8 may already have the fix. Anyone telling you from
						outside that your site is definitely vulnerable is guessing from a banner.
					</p>
					<p className='mt-3 text-[16px] leading-relaxed text-body'>
						What it does do is read, from one ordinary request, the things your server
						volunteers to every visitor: your PHP banner if present, your hosting
						platform, whether WordPress is in use, whether XML-RPC is advertised, and
						which of the six common security headers you send. That is a configuration
						check, and it is a genuinely useful one.
					</p>
				</section>

				{/* ── FAQ, wording matched to real search phrasing ───────── */}
				<section className='mt-14'>
					<h2 className='font-heading text-[26px] font-black tracking-tight text-ink'>
						Common questions
					</h2>
					<div className='mt-5 flex flex-col divide-y divide-border-soft border-y border-border-soft'>
						{FAQS.map((f) => (
							<div key={f.q} className='py-5'>
								<h3 className='text-[16.5px] font-bold text-ink'>{f.q}</h3>
								<p className='mt-2 text-[15.5px] leading-relaxed text-body'>{f.a}</p>
							</div>
						))}
					</div>
				</section>

				<section className='mt-14 rounded-2xl bg-slate-deep p-7'>
					<h2 className='font-heading text-[23px] font-black text-white'>
						Want the rest of your site checked?
					</h2>
					<p className='mt-2.5 text-[15.5px] leading-relaxed text-white/75'>
						This page reads one response. A full scan opens your site in a real browser
						and tests the pages you choose — broken links, forms that submit but never
						arrive, mobile layout failures, and these configuration findings across the
						whole site, each with a screenshot showing exactly what we saw. Free for your
						homepage, no signup.
					</p>
					<Link
						href='/?utm_source=php_checker&utm_medium=page'
						className='mt-5 inline-flex items-center justify-center rounded-xl bg-accent-bright px-6 py-3 text-[15px] font-extrabold text-white transition hover:-translate-y-0.5'>
						Run a free scan →
					</Link>
				</section>

				<p className='mt-8 text-[13px] text-muted-ink'>
					Last reviewed <time dateTime={LAST_REVIEWED}>{LAST_REVIEWED}</time>. Written and
					maintained by Waqas Ahmad, a QA engineer with nine years&rsquo; experience.
				</p>
			</main>

			<SiteFooter />
		</>
	)
}
