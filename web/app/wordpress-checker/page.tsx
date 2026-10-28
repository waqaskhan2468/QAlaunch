import type { Metadata } from 'next'
import Link from 'next/link'

import { SiteFooter } from '@/components/site/site-footer'
import { SiteNav } from '@/components/site/site-nav'
import { WordPressChecker } from '@/components/wordpress-check/wordpress-checker'
import { faqPageSchema, jsonLd, SITE_URL } from '@/lib/seo/structured-data'

/**
 * WordPress site checker.
 *
 * Built from Search Console rather than guesswork. Over three months these
 * queries produced roughly 600 impressions of genuine intent and almost no
 * clicks, because they currently land on /for-wordpress — a landing page
 * sitting at position 20:
 *
 *   wordpress checker              125 imp   pos  9.4
 *   wordpress site checker          85 imp   pos 10.0
 *   diagnose wordpress site         49 imp   pos 15.5
 *   wordpress site analysis         35 imp   pos 33.3
 *   wordpress broken                31 imp   pos 32.6
 *   is this site wordpress          27 imp   pos 31.9
 *   wordpress update broke my site  24 imp   pos 65.1
 *
 * The same data shows which shape wins: /php-version-checker, which answers
 * instantly from one request, earns 6.17% CTR at position 7.8, while the
 * landing pages sit near 1.8%. People searching this want something that
 * does the thing.
 *
 * Three intents are mixed in those queries and the page serves all three:
 * detection ("is this site wordpress"), the tool itself ("wordpress
 * checker"), and diagnosis ("wordpress update broke my site"). Only the first
 * two can be answered from outside, and the page says so rather than implying
 * it can diagnose a broken update it cannot see.
 */

const LAST_REVIEWED = '2026-10-28'

export const metadata: Metadata = {
	alternates: { canonical: '/wordpress-checker' },
	title: 'WordPress Site Checker — Is It WordPress, and Is It Healthy?',
	description:
		'Free WordPress checker. Paste any address to see whether it runs WordPress, which version it publishes, its hosting and its security headers. No signup, one request.',
	openGraph: {
		title: 'WordPress Site Checker — Free, No Signup',
		description:
			'Check whether a site runs WordPress, what version it publishes, and what its headers reveal. Instant, from one request.',
		url: `${SITE_URL}/wordpress-checker`,
	},
}

const FAQS = [
	{
		q: 'How do I check if a website is built with WordPress?',
		a: 'Paste the address into the checker above. We load the homepage once and look for five things WordPress publishes about itself: the generator meta tag, files loaded from /wp-content/ and /wp-includes/, an X-Pingback header, and the WordPress REST API advertised in the Link header. Any one of those is strong evidence; none of them means it is probably not WordPress, though a heavily customised or fully cached site can hide all five.',
	},
	{
		q: 'How do I find out what WordPress version a site is running?',
		a: 'WordPress publishes its version in a generator meta tag, and the checker reads it when present. Most sites do not publish it — security plugins strip that tag precisely because announcing your version tells attackers which exploits to try. If the version comes back blank, that is a sign the site is configured sensibly, not a failure of the check. On your own site you can always see it under Tools, Site Health, Info, WordPress.',
	},
	{
		q: 'Can you tell me why my WordPress site broke after an update?',
		a: 'Not from outside, and nobody else can either. A broken update usually involves a plugin conflict, a theme file or a PHP error, and none of that is visible from a single page request. What a scan can show you is the result: a form that submits but never arrives, a button pushed off screen on a phone, a page returning an error, a layout that collapsed. If you want the cause rather than the symptom, you need access to the site itself.',
	},
	{
		q: 'Is this a WordPress security scanner?',
		a: 'No. It reads what your server publishes to every visitor — whether WordPress is in use, the version if announced, your hosting platform, whether XML-RPC is advertised, and which common security headers you send. It does not test for vulnerabilities, scan for malware, or check your plugins, and it cannot tell you whether a site has been broken into. Tools that genuinely detect a compromise run installed on the site, which is why Wordfence and Patchstack work that way.',
	},
	{
		q: 'Does checking someone else’s site cause them any problem?',
		a: 'No. It makes exactly one request to the address you type — the same single page load any visitor makes — and reads the response. It does not request hidden paths, submit forms, try passwords or attempt to get around a firewall. If a site blocks the request we report that it blocked us and stop there.',
	},
	{
		q: 'What does the full scan check that this page does not?',
		a: 'The free scan opens your site in a real browser and uses it the way a visitor would: it follows your links to find the broken ones, submits forms to see whether they actually work, renders the page at phone width to catch buttons pushed off screen, runs accessibility checks and captures console errors. This page reads one response; the scan interacts with the site.',
	},
]

export default function Page() {
	const appSchema = {
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: 'WordPress Site Checker',
		url: `${SITE_URL}/wordpress-checker`,
		applicationCategory: 'DeveloperApplication',
		operatingSystem: 'Web',
		browserRequirements: 'Requires JavaScript',
		description:
			'Checks whether a website runs WordPress, which version it publishes, its hosting platform and its security headers.',
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
		creator: { '@type': 'Organization', name: 'QAlaunch', url: SITE_URL },
		dateModified: LAST_REVIEWED,
	}

	return (
		<>
			<script
				type='application/ld+json'
				dangerouslySetInnerHTML={{ __html: jsonLd(faqPageSchema(FAQS)) }}
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
				<h1 className='mt-3 font-heading text-[34px] font-black leading-[1.15] tracking-tight text-ink md:text-[42px]'>
					Is this site WordPress — and is it healthy?
				</h1>

				{/* The answer up front, self-contained, before anything else. */}
				<p className='mt-4 text-[17px] leading-relaxed text-body'>
					Paste any address to find out whether it runs WordPress, which version it
					publishes, who hosts it, and which security headers it sends. We load the
					homepage once, read what it already tells every visitor, and show you the
					result. Free, no signup, nothing installed.
				</p>

				<div className='mt-7'>
					<WordPressChecker />
				</div>

				<section className='mt-14'>
					<h2 className='font-heading text-[26px] font-black tracking-tight text-ink'>
						How you can tell a site is WordPress
					</h2>
					<p className='mt-3 text-[16px] leading-relaxed text-body'>
						WordPress leaves five fingerprints on a page it serves, and this checker reads
						all of them from a single request:
					</p>
					<ol className='mt-4 flex list-decimal flex-col gap-2.5 pl-5 text-[16px] leading-relaxed text-body marker:font-bold marker:text-brand'>
						<li>
							<strong className='text-ink'>The generator tag</strong> — a line in the page
							source naming WordPress and often the exact version.
						</li>
						<li>
							<strong className='text-ink'>/wp-content/</strong> — themes, plugins and
							uploads load from this folder.
						</li>
						<li>
							<strong className='text-ink'>/wp-includes/</strong> — core scripts load from
							here.
						</li>
						<li>
							<strong className='text-ink'>The X-Pingback header</strong> — announces
							XML-RPC, which WordPress enables by default.
						</li>
						<li>
							<strong className='text-ink'>The REST API link</strong> — a Link header
							pointing at api.w.org.
						</li>
					</ol>
					<p className='mt-4 text-[16px] leading-relaxed text-body'>
						A well-hardened site can hide every one of them, so an empty result is
						evidence rather than proof. It is also, usually, a sign of a site that has
						been set up carefully.
					</p>
				</section>

				<section className='mt-14'>
					<h2 className='font-heading text-[26px] font-black tracking-tight text-ink'>
						What this cannot tell you
					</h2>
					<p className='mt-3 text-[16px] leading-relaxed text-body'>
						It cannot tell you why an update broke your site. A single page request
						reveals nothing about your plugins, your theme files, your database or your
						users, and that is where a broken update actually lives. It cannot tell you
						whether a site has been compromised either — no external checker can, which
						is exactly why the tools that genuinely detect that run installed on the
						site.
					</p>
					<p className='mt-3 text-[16px] leading-relaxed text-body'>
						What it does do is read, honestly, what your server volunteers to every
						visitor. If you want to know what a real visitor experiences — the link that
						404s, the contact form that submits and never arrives, the button pushed off
						the screen on a phone — that needs a browser to actually use the site, which
						is what the{' '}
						<Link href='/' className='font-semibold text-brand hover:underline'>
							free scan
						</Link>{' '}
						does.
					</p>
				</section>

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

				<p className='mt-10 text-[13px] text-muted-ink'>
					Last reviewed <time dateTime={LAST_REVIEWED}>{LAST_REVIEWED}</time>. Written and
					maintained by Waqas Ahmad, a QA engineer with nine years&rsquo; experience.
				</p>
			</main>

			<SiteFooter />
		</>
	)
}
