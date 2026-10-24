import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { AlertTriangle, Check, X } from "lucide-react"

import { PhpChecker } from "@/components/php-check/php-checker"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteNav } from "@/components/site/site-nav"
import { FIXED_IN, PHP2SHELL } from "@/lib/php-check/php-versions"
import {
	allVersions,
	buildVersionFacts,
	relatedVersions,
	versionAnswer,
	versionDescription,
	versionTitle,
	humanDate,
	type VersionFacts,
} from "@/lib/php-check/version-page"
import { faqPageSchema, jsonLd, SITE_URL } from "@/lib/seo/structured-data"

/**
 * One page per PHP release.
 *
 * People search exact patch levels — "php 8.3.28 vulnerability", "php 8.2.31
 * vulnerability" and so on are confirmed autocomplete queries — and no
 * incumbent holds any individual version page. The closest thing is a static
 * GitHub Pages table with no verdict and no tool.
 *
 * Statically generated, so all 205 are plain HTML with no runtime cost.
 *
 * Every page is built from php.net's release index and the two php-src
 * advisories. None of the text is written per version, so there is no version
 * number anywhere that a human could have mistyped.
 */

export const dynamicParams = false

export async function generateStaticParams() {
	return allVersions().map((version) => ({ version }))
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ version: string }>
}): Promise<Metadata> {
	const { version } = await params
	const facts = buildVersionFacts(version)
	if (!facts) return {}

	return {
		alternates: { canonical: `/php/${version}` },
		title: versionTitle(facts),
		description: versionDescription(facts),
		openGraph: {
			title: versionTitle(facts),
			description: versionDescription(facts),
			url: `${SITE_URL}/php/${version}`,
		},
	}
}

export default async function Page({
	params,
}: {
	params: Promise<{ version: string }>
}) {
	const { version } = await params
	const facts = buildVersionFacts(version)
	if (!facts) notFound()

	const answer = versionAnswer(facts)
	const related = relatedVersions(version)

	const faqs = buildFaqs(facts)

	const schema = {
		"@context": "https://schema.org",
		"@type": "TechArticle",
		headline: versionTitle(facts),
		description: versionDescription(facts),
		url: `${SITE_URL}/php/${version}`,
		datePublished: PHP2SHELL.disclosed,
		dateModified: PHP2SHELL.disclosed,
		author: { "@type": "Person", name: "Waqas Ahmad" },
		publisher: { "@type": "Organization", name: "QAlaunch", url: SITE_URL },
		about: { "@type": "SoftwareApplication", name: `PHP ${version}`, softwareVersion: version },
	}

	return (
		<>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: jsonLd(faqPageSchema(faqs)) }}
			/>
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />

			<SiteNav />

			<main className="mx-auto max-w-3xl px-5 pb-24 pt-10 md:px-8 md:pt-14">
				<nav className="text-[13px] text-muted-ink">
					<Link href="/php-version-checker" className="font-semibold text-brand hover:underline">
						PHP version checker
					</Link>
					<span className="mx-1.5">/</span>
					<span>PHP {facts.version}</span>
				</nav>

				<h1 className="mt-3 font-heading text-[32px] font-black leading-[1.15] tracking-tight text-ink md:text-[40px]">
					Is PHP {facts.version} vulnerable?
				</h1>

				{/* The whole answer, self-contained, before anything else. */}
				<div
					className={
						"mt-5 flex gap-3 rounded-2xl border-2 p-5 " +
						(facts.hasFix ? "border-accent-emerald/40 bg-accent-emerald/5"
						: !facts.branchSupported ? "border-red-300 bg-red-50"
						: "border-amber-400/50 bg-amber-50")
					}
				>
					<div className="mt-0.5 shrink-0">
						{facts.hasFix ?
							<Check className="size-5 text-accent-emerald" aria-hidden="true" />
						: !facts.branchSupported ?
							<X className="size-5 text-red-600" aria-hidden="true" />
						:	<AlertTriangle className="size-5 text-amber-600" aria-hidden="true" />}
					</div>
					<p className="text-[16.5px] font-semibold leading-relaxed text-ink">{answer}</p>
				</div>

				<dl className="mt-7 divide-y divide-border-soft border-y border-border-soft">
					<Fact label="Released" value={humanDate(facts.releaseDate)} />
					<Fact
						label="Branch"
						value={`PHP ${facts.branch}`}
						note={
							facts.branchSupported ?
								"Still receiving security updates."
							:	"End of life — no security updates of any kind."
						}
					/>
					{facts.fixedIn ? (
						<Fact
							label="Fix shipped in"
							value={`PHP ${facts.fixedIn}`}
							note={`The first ${facts.branch} release carrying the October 2026 patch.`}
						/>
					) : null}
					<Fact
						label="Newest on this branch"
						value={`PHP ${facts.latestOnBranch}`}
						note={
							facts.releasesSince === 0 ?
								"This is the newest release on this branch."
							:	`${facts.releasesSince} release${facts.releasesSince === 1 ? "" : "s"} have shipped since ${facts.version}.`
						}
					/>
				</dl>

				{/* The caveat, every time, for a supported branch below the fix. */}
				{!facts.hasFix && facts.branchSupported ? (
					<section className="mt-10">
						<h2 className="font-heading text-[24px] font-black tracking-tight text-ink">
							Why this does not automatically mean your site is exposed
						</h2>
						<p className="mt-3 text-[16px] leading-relaxed text-body">
							CloudLinux, CloudLinux, Debian, Ubuntu and Red Hat apply security fixes to older releases without
							changing the version number. A server can report PHP {facts.version} and
							already have the patch for {PHP2SHELL.cves[0]} applied, because the
							distribution backported it. Tenable stopped relying on version numbers
							alone for exactly this reason.
						</p>
						<p className="mt-3 text-[16px] leading-relaxed text-body">
							So the version string tells you what was printed, not what was patched.
							The reliable answer comes from your host. On managed hosting it is usually
							on their status page; on cPanel it is under MultiPHP Manager.
						</p>
					</section>
				) : null}

				{!facts.branchSupported ? (
					<section className="mt-10">
						<h2 className="font-heading text-[24px] font-black tracking-tight text-ink">
							What end of life actually means
						</h2>
						<p className="mt-3 text-[16px] leading-relaxed text-body">
							The PHP {facts.branch} branch no longer receives security updates. No patch
							level on it is current, and nothing found from now on will be fixed for it.
							That is a different and more durable problem than any single CVE: it will
							not improve on its own, and backporting by your Linux distribution has its
							own end date too.
						</p>
						<p className="mt-3 text-[16px] leading-relaxed text-body">
							The oldest branch still supported is PHP 8.2, patched at{" "}
							<Link href={`/php/${FIXED_IN["8.2"]}`} className="font-semibold text-brand hover:underline">
								{FIXED_IN["8.2"]}
							</Link>
							. Most hosts let you change PHP version from their control panel. Take a
							backup, move up one minor version at a time, and check the site after each
							step.
						</p>
					</section>
				) : null}

				<section className="mt-12">
					<h2 className="font-heading text-[24px] font-black tracking-tight text-ink">
						What version is your site actually running?
					</h2>
					<p className="mt-2.5 text-[16px] leading-relaxed text-body">
						Check any site below. We load the homepage once and read what it reports —
						no signup. Most servers hide their PHP version, which is the right thing for
						them to do, so if nothing comes back the page explains where to look instead.
					</p>
					<div className="mt-5">
						<PhpChecker />
					</div>
				</section>

				{related.length > 0 ? (
					<section className="mt-12">
						<h2 className="font-heading text-[20px] font-black tracking-tight text-ink">
							Other PHP {facts.branch} releases
						</h2>
						<ul className="mt-3 flex flex-wrap gap-2">
							{related.map((v) => (
								<li key={v}>
									<Link
										href={`/php/${v}`}
										className="inline-flex rounded-lg border border-border-soft px-3 py-1.5 font-mono text-[13.5px] text-ink transition hover:border-brand hover:text-brand"
									>
										{v}
									</Link>
								</li>
							))}
						</ul>
					</section>
				) : null}

				<section className="mt-12">
					<h2 className="font-heading text-[24px] font-black tracking-tight text-ink">
						Common questions
					</h2>
					<div className="mt-4 flex flex-col divide-y divide-border-soft border-y border-border-soft">
						{faqs.map((f) => (
							<div key={f.q} className="py-5">
								<h3 className="text-[16px] font-bold text-ink">{f.q}</h3>
								<p className="mt-2 text-[15.5px] leading-relaxed text-body">{f.a}</p>
							</div>
						))}
					</div>
				</section>

				<p className="mt-10 text-[13px] leading-relaxed text-muted-ink">
					Release dates from php.net&rsquo;s release index. Advisory details from the PHP
					project&rsquo;s own security advisories{" "}
					<span className="font-mono">{PHP2SHELL.advisories[0]}</span> and{" "}
					<span className="font-mono">{PHP2SHELL.advisories[1]}</span>, both CVSS{" "}
					{PHP2SHELL.cvss}, published {PHP2SHELL.disclosed}.
				</p>
			</main>

			<SiteFooter />
		</>
	)
}

function Fact({ label, value, note }: { label: string; value: string; note?: string }) {
	return (
		<div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:gap-4">
			<dt className="w-44 shrink-0 text-[13px] font-bold text-muted-ink">{label}</dt>
			<dd className="min-w-0 text-[15px] leading-relaxed">
				<span className="font-bold text-ink">{value}</span>
				{note ? <span className="text-body"> — {note}</span> : null}
			</dd>
		</div>
	)
}

function buildFaqs(f: VersionFacts) {
	const faqs = [
		{
			q: `Is PHP ${f.version} affected by ${PHP2SHELL.cves[0]}?`,
			a: versionAnswer(f),
		},
		{
			q: `What PHP version should I upgrade ${f.version} to?`,
			a:
				!f.branchSupported ?
					`PHP ${f.branch} receives no security updates, so staying on it is the problem rather than the patch level. The oldest supported branch is 8.2. Take a backup, change the PHP version in your hosting control panel, and move up one minor version at a time, checking the site after each step.`
				: f.releasesSince === 0 ?
					`Nothing, on this branch — PHP ${f.version} is the newest ${f.branch} release, so you are already current. The only move left is to a newer branch, which buys you a longer support window but is more likely to need plugin or code changes. Test it on a staging copy first.`
				:	`The newest release on the ${f.branch} branch is PHP ${f.latestOnBranch}, which is the smallest change from ${f.version} and keeps you on a supported branch. Moving to a newer branch entirely gives you longer support, but is more likely to need plugin or code changes, so test it first.`,
		},
		{
			q: `How do I check which PHP version my site runs?`,
			a: `In WordPress, go to Tools → Site Health → Info → Server; the PHP version is the first line, and you need no cPanel, FTP or SSH access. You can also paste your address into the checker on this page, though most servers hide their version — in a sample of twenty WordPress sites, only one published it.`,
		},
	]

	if (!f.hasFix && f.branchSupported) {
		faqs.push({
			q: `My server reports PHP ${f.version}. Does that mean I am definitely vulnerable?`,
			a: `No. CloudLinux, Debian, Ubuntu and Red Hat all backport security fixes into older releases without changing the version number, so a server reporting ${f.version} may already have the patch applied. The version string records what was printed, not what was patched. Ask your host, or check your control panel, for the definitive answer.`,
		})
	}

	return faqs
}
