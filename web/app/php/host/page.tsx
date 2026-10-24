import type { Metadata } from "next"
import Link from "next/link"

import { SiteFooter } from "@/components/site/site-footer"
import { SiteNav } from "@/components/site/site-nav"
import { HOSTS, HOSTS_REVIEWED, statusLabel, type HostStatus } from "@/lib/php-check/hosts"
import { PHP2SHELL } from "@/lib/php-check/php-versions"
import { humanDate } from "@/lib/php-check/version-page"
import { jsonLd, SITE_URL } from "@/lib/seo/structured-data"

/**
 * The table itself.
 *
 * Search results for "did my host patch php" are roughly a third Reddit
 * threads, because Reddit is the only place the answer stays current. The
 * better competitor articles each contain a "what hosts are saying" section —
 * written once, as prose, never updated. Nobody has published this as a dated,
 * maintained, per-host resource.
 *
 * Every row is the host's own published words, linked. Rows with no statement
 * say so, which is the honest answer and the one most rows will carry.
 */

export const metadata: Metadata = {
	alternates: { canonical: "/php/host" },
	title: "Which hosts have patched the October 2026 PHP vulnerability?",
	description:
		"What each major web host has publicly said about patching CVE-2026-109618 and CVE-2026-109619, with dates and direct links to their own statements. Updated, and honest about what we could not find.",
	openGraph: {
		title: "Which web hosts have patched the October 2026 PHP vulnerability?",
		description:
			"Per-host PHP patch status, quoted from each host's own published statement, with dates and links.",
		url: `${SITE_URL}/php/host`,
	},
}

const ORDER: HostStatus[] = [
	"published_patched",
	"published_action_required",
	"published_acknowledged",
	"not_found",
]

const DOT: Record<HostStatus, string> = {
	published_patched: "bg-accent-emerald",
	published_action_required: "bg-amber-500",
	published_acknowledged: "bg-amber-400",
	not_found: "bg-border-soft",
}

export default function Page() {
	const sorted = [...HOSTS].sort(
		(a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || a.name.localeCompare(b.name),
	)

	const schema = {
		"@context": "https://schema.org",
		"@type": "Dataset",
		name: "Web host PHP patch status, October 2026",
		description: `What each major web host has publicly stated about patching ${PHP2SHELL.cves[0]} and ${PHP2SHELL.cves[1]}.`,
		url: `${SITE_URL}/php/host`,
		dateModified: HOSTS_REVIEWED,
		creator: { "@type": "Organization", name: "QAlaunch", url: SITE_URL },
	}

	return (
		<>
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />

			<SiteNav />

			<main className="mx-auto max-w-3xl px-5 pb-24 pt-10 md:px-8 md:pt-14">
				<nav className="text-[13px] text-muted-ink">
					<Link href="/php-version-checker" className="font-semibold text-brand hover:underline">
						PHP version checker
					</Link>
					<span className="mx-1.5">/</span>
					<span>Hosts</span>
				</nav>

				<h1 className="mt-3 font-heading text-[32px] font-black leading-[1.15] tracking-tight text-ink md:text-[40px]">
					Which hosts have patched the October 2026 PHP vulnerability?
				</h1>

				<p className="mt-4 text-[17px] leading-relaxed text-body">
					What each host has <strong className="text-ink">publicly said</strong> about{" "}
					{PHP2SHELL.cves[0]} and {PHP2SHELL.cves[1]} — quoted from their own pages, with
					dates and links so you can check for yourself. Last gone through on{" "}
					<time dateTime={HOSTS_REVIEWED} className="font-semibold text-ink">
						{humanDate(HOSTS_REVIEWED)}
					</time>
					.
				</p>

				<p className="mt-3 text-[16px] leading-relaxed text-body">
					Where a host has said nothing publicly, the row says exactly that. That is not
					evidence they have not patched — plenty do it quietly and never announce it. It
					means we found nothing to quote, and we would rather tell you that than guess on
					a company&rsquo;s behalf.
				</p>

				{sorted.length === 0 ? (
					<p className="mt-8 rounded-xl border-2 border-border-soft bg-surface-soft p-5 text-[15px] text-body">
						No hosts recorded yet.
					</p>
				) : (
					<div className="mt-8 overflow-x-auto">
						<table className="w-full border-collapse text-[15px]">
							<thead>
								<tr className="border-b-2 border-slate-deep text-left">
									<th className="py-2.5 pr-4 font-bold text-ink">Host</th>
									<th className="py-2.5 pr-4 font-bold text-ink">What they have said</th>
									<th className="py-2.5 font-bold text-ink">Dated</th>
								</tr>
							</thead>
							<tbody>
								{sorted.map((h) => (
									<tr key={h.slug} className="border-b border-border-soft align-top">
										<td className="py-3 pr-4">
											<Link
												href={`/php/host/${h.slug}`}
												className="font-semibold text-brand hover:underline"
											>
												{h.name}
											</Link>
										</td>
										<td className="py-3 pr-4 text-body">
											<span className="inline-flex items-center gap-2">
												<span
													aria-hidden="true"
													className={`inline-block size-2 shrink-0 rounded-full ${DOT[h.status]}`}
												/>
												{statusLabel(h.status)}
											</span>
										</td>
										<td className="py-3 text-body">
											{h.sourceDate ? humanDate(h.sourceDate) : "—"}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}

				<section className="mt-12">
					<h2 className="font-heading text-[24px] font-black tracking-tight text-ink">
						Why your host&rsquo;s announcement is not the whole answer
					</h2>
					<p className="mt-3 text-[16px] leading-relaxed text-body">
						A host patching their fleet covers the PHP they run. It does not tell you
						which PHP version <em>your</em> site is set to use — most hosts let you pick,
						and a site pinned to an old branch stays on it. So the announcement and your
						own site are two different questions.
					</p>
					<p className="mt-3 text-[16px] leading-relaxed text-body">
						Check yours in WordPress under{" "}
						<strong className="text-ink">Tools → Site Health → Info → Server</strong>, or
						with the{" "}
						<Link href="/php-version-checker" className="font-semibold text-brand hover:underline">
							PHP version checker
						</Link>
						.
					</p>
				</section>

				<p className="mt-10 text-[13px] leading-relaxed text-muted-ink">
					This page records what each company has published, not our own assessment of
					their infrastructure — we cannot see inside any host. If a host has published
					something since {humanDate(HOSTS_REVIEWED)}, their own site is the authority.
				</p>
			</main>

			<SiteFooter />
		</>
	)
}
