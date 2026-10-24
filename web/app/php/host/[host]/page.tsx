import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { AlertTriangle, Check, HelpCircle, Info } from "lucide-react"

import { PhpChecker } from "@/components/php-check/php-checker"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteNav } from "@/components/site/site-nav"
import { HOSTS, HOSTS_REVIEWED, hostBySlug, statusLabel, type HostRecord } from "@/lib/php-check/hosts"
import { FIXED_IN, PHP2SHELL } from "@/lib/php-check/php-versions"
import { humanDate } from "@/lib/php-check/version-page"
import { faqPageSchema, jsonLd, SITE_URL } from "@/lib/seo/structured-data"

/**
 * One page per host, answering "has my host patched this".
 *
 * The search results for that question are mostly Reddit, because Reddit is
 * the only place the answer stays current. The competitor articles that do
 * cover it bury it in a "what hosts are saying" section that nobody updates.
 *
 * Everything on these pages comes from the host's own published statement,
 * quoted and linked so a reader can check it themselves. Where a host has said
 * nothing, the page says exactly that and points them at the method that works
 * regardless — which is more useful than a guess and is the honest answer.
 */

export const dynamicParams = false

export async function generateStaticParams() {
	return HOSTS.map((h) => ({ host: h.slug }))
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ host: string }>
}): Promise<Metadata> {
	const { host } = await params
	const h = hostBySlug(host)
	if (!h) return {}

	const title = `Has ${h.name} patched the October 2026 PHP vulnerability?`
	const description =
		h.status === "not_found" ?
			`We could not find a public statement from ${h.name} about ${PHP2SHELL.cves[0]} as of ${humanDate(HOSTS_REVIEWED)}. Here is how to check your own PHP version either way.`
		:	`${statusLabel(h.status)}. What ${h.name} published, when, and what it means for your site.`

	return {
		alternates: { canonical: `/php/host/${h.slug}` },
		title,
		description,
		openGraph: { title, description, url: `${SITE_URL}/php/host/${h.slug}` },
	}
}

export default async function Page({ params }: { params: Promise<{ host: string }> }) {
	const { host } = await params
	const h = hostBySlug(host)
	if (!h) notFound()

	const faqs = buildFaqs(h)

	return (
		<>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: jsonLd(faqPageSchema(faqs)) }}
			/>

			<SiteNav />

			<main className="mx-auto max-w-3xl px-5 pb-24 pt-10 md:px-8 md:pt-14">
				<nav className="text-[13px] text-muted-ink">
					<Link href="/php-version-checker" className="font-semibold text-brand hover:underline">
						PHP version checker
					</Link>
					<span className="mx-1.5">/</span>
					<Link href="/php/host" className="font-semibold text-brand hover:underline">
						Hosts
					</Link>
					<span className="mx-1.5">/</span>
					<span>{h.name}</span>
				</nav>

				<h1 className="mt-3 font-heading text-[31px] font-black leading-[1.15] tracking-tight text-ink md:text-[39px]">
					Has {h.name} patched the October 2026 PHP vulnerability?
				</h1>

				<StatusPanel host={h} />

				{h.quote && h.source ? (
					<figure className="mt-6 border-l-4 border-brand pl-5">
						<blockquote className="text-[16.5px] italic leading-relaxed text-ink">
							&ldquo;{h.quote}&rdquo;
						</blockquote>
						<figcaption className="mt-2 text-[13.5px] text-muted-ink">
							— {h.name},{" "}
							{h.sourceDate ? (
								<time dateTime={h.sourceDate}>{humanDate(h.sourceDate)}</time>
							) : (
								"date not shown on the page"
							)}
							.{" "}
							<a
								href={h.source}
								rel="nofollow noopener"
								target="_blank"
								className="font-semibold text-brand hover:underline"
							>
								Read it on {h.name}&rsquo;s site →
							</a>
						</figcaption>
					</figure>
				) : null}

				{h.customerAction ? (
					<section className="mt-9">
						<h2 className="font-heading text-[23px] font-black tracking-tight text-ink">
							What {h.name} says you should do
						</h2>
						<p className="mt-2.5 text-[16px] leading-relaxed text-body">{h.customerAction}</p>
					</section>
				) : null}

				{h.notes ? (
					<div className="mt-7 flex gap-3 rounded-xl border-2 border-border-soft bg-surface-soft p-4">
						<Info className="mt-0.5 size-4 shrink-0 text-muted-ink" aria-hidden="true" />
						<p className="text-[14px] leading-relaxed text-body">{h.notes}</p>
					</div>
				) : null}

				{/* Works on every host, which is why it is here on every page. */}
				<section className="mt-11">
					<h2 className="font-heading text-[23px] font-black tracking-tight text-ink">
						How to check your own site, whatever your host has said
					</h2>
					<p className="mt-2.5 text-[16px] leading-relaxed text-body">
						A host&rsquo;s announcement covers their fleet. The only thing that tells you
						about <em>your</em> site is your site. In WordPress:
					</p>
					<ol className="mt-4 flex list-decimal flex-col gap-2 pl-5 text-[16px] leading-relaxed text-body marker:font-bold marker:text-brand">
						<li>Log in to WordPress.</li>
						<li>
							Go to <strong className="text-ink">Tools → Site Health</strong>.
						</li>
						<li>
							Open the <strong className="text-ink">Info</strong> tab.
						</li>
						<li>
							Expand <strong className="text-ink">Server</strong>. PHP version is the first
							line.
						</li>
					</ol>
					<p className="mt-4 text-[16px] leading-relaxed text-body">
						The fix shipped in PHP{" "}
						<Link href={`/php/${FIXED_IN["8.2"]}`} className="font-semibold text-brand hover:underline">
							{FIXED_IN["8.2"]}
						</Link>
						,{" "}
						<Link href={`/php/${FIXED_IN["8.3"]}`} className="font-semibold text-brand hover:underline">
							{FIXED_IN["8.3"]}
						</Link>
						,{" "}
						<Link href={`/php/${FIXED_IN["8.4"]}`} className="font-semibold text-brand hover:underline">
							{FIXED_IN["8.4"]}
						</Link>{" "}
						and{" "}
						<Link href={`/php/${FIXED_IN["8.5"]}`} className="font-semibold text-brand hover:underline">
							{FIXED_IN["8.5"]}
						</Link>
						. A version below those does not automatically mean you are exposed — hosts and
						Linux distributions routinely apply the patch without changing the version
						number.
					</p>
				</section>

				<section className="mt-11">
					<h2 className="font-heading text-[23px] font-black tracking-tight text-ink">
						Check what your site reports
					</h2>
					<p className="mt-2.5 text-[16px] leading-relaxed text-body">
						We load your homepage once and read what it publishes. Most servers hide their
						PHP version, which is correct of them — so this often comes back empty, and
						the result tells you where to look instead.
					</p>
					<div className="mt-5">
						<PhpChecker />
					</div>
				</section>

				<section className="mt-12">
					<h2 className="font-heading text-[23px] font-black tracking-tight text-ink">
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

				<OtherHosts current={h.slug} />

				<p className="mt-10 text-[13px] leading-relaxed text-muted-ink">
					This page records what {h.name} has published, not our own assessment of their
					infrastructure. We cannot see inside any host. Last checked{" "}
					<time dateTime={HOSTS_REVIEWED}>{humanDate(HOSTS_REVIEWED)}</time> — if {h.name}{" "}
					has published something since, their own site is the authority.
				</p>
			</main>

			<SiteFooter />
		</>
	)
}

function StatusPanel({ host: h }: { host: HostRecord }) {
	const map = {
		published_patched: {
			tone: "border-accent-emerald/40 bg-accent-emerald/5",
			icon: <Check className="size-5 text-accent-emerald" aria-hidden="true" />,
			text: `${h.name} has publicly stated that it patched PHP for ${PHP2SHELL.cves[0]} and ${PHP2SHELL.cves[1]}${h.sourceDate ? `, on ${humanDate(h.sourceDate)}` : ""}.`,
		},
		published_acknowledged: {
			tone: "border-amber-400/50 bg-amber-50",
			icon: <AlertTriangle className="size-5 text-amber-600" aria-hidden="true" />,
			text: `${h.name} has published something about this, but does not clearly state that patching is complete. Their own page is quoted below so you can judge it.`,
		},
		published_action_required: {
			tone: "border-amber-400/50 bg-amber-50",
			icon: <AlertTriangle className="size-5 text-amber-600" aria-hidden="true" />,
			text: `${h.name} says customers need to take action themselves rather than waiting for an automatic update.`,
		},
		not_found: {
			tone: "border-border-soft bg-surface-soft",
			icon: <HelpCircle className="size-5 text-muted-ink" aria-hidden="true" />,
			text: `We could not find any public statement from ${h.name} about this, as of ${humanDate(HOSTS_REVIEWED)}. That is not evidence either way — plenty of hosts patch quietly and never announce it. Check your own PHP version below, and ask their support if you want it confirmed.`,
		},
	}[h.status]

	return (
		<div className={`mt-5 flex gap-3 rounded-2xl border-2 p-5 ${map.tone}`}>
			<div className="mt-0.5 shrink-0">{map.icon}</div>
			<div className="min-w-0">
				<p className="text-[13px] font-bold uppercase tracking-wider text-muted-ink">
					{statusLabel(h.status)}
				</p>
				<p className="mt-1 text-[16.5px] font-semibold leading-relaxed text-ink">{map.text}</p>
			</div>
		</div>
	)
}

function OtherHosts({ current }: { current: string }) {
	const others = HOSTS.filter((h) => h.slug !== current)
	if (others.length === 0) return null

	return (
		<section className="mt-12">
			<h2 className="font-heading text-[20px] font-black tracking-tight text-ink">
				Other hosts
			</h2>
			<ul className="mt-3 flex flex-wrap gap-2">
				{others.map((h) => (
					<li key={h.slug}>
						<Link
							href={`/php/host/${h.slug}`}
							className="inline-flex rounded-lg border border-border-soft px-3 py-1.5 text-[13.5px] text-ink transition hover:border-brand hover:text-brand"
						>
							{h.name}
						</Link>
					</li>
				))}
			</ul>
		</section>
	)
}

function buildFaqs(h: HostRecord) {
	const faqs = [
		{
			q: `Has ${h.name} patched ${PHP2SHELL.cves[0]}?`,
			a:
				h.status === "not_found" ?
					`We could not find a public statement from ${h.name} about this as of ${humanDate(HOSTS_REVIEWED)}. Many hosts patch without announcing it, so this is not evidence that they have not. The reliable check is your own site: in WordPress, Tools → Site Health → Info → Server shows your PHP version.`
				: h.status === "published_patched" ?
					`${h.name} has publicly stated that it patched PHP for this issue${h.sourceDate ? `, in a statement dated ${humanDate(h.sourceDate)}` : ""}. Their own page is linked on this page so you can read the wording yourself.`
				: h.status === "published_action_required" ?
					`${h.name} has published guidance saying customers need to act themselves rather than waiting for an automatic update. The specifics are on this page.`
				:	`${h.name} has published something about this but does not clearly state that patching is complete. We quote their wording on this page rather than interpreting it for you.`,
		},
		{
			q: `How do I check what PHP version my ${h.name} site is running?`,
			a: `In WordPress, go to Tools → Site Health → Info → Server. The PHP version is the first line, and you need no cPanel, FTP or SSH access for it. Most hosts also show the PHP version somewhere in their own control panel, and let you change it there.`,
		},
		{
			q: `My site reports a PHP version below the fix. Does that mean it is vulnerable?`,
			a: `Not necessarily. Hosts and CloudLinux routinely apply security patches to older releases without changing the version number, so a server can report an older version and already have the fix. The version string records what was printed, not what was patched. Your host's support can confirm it definitively.`,
		},
	]
	return faqs
}
