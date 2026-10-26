import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { SiteNav } from "@/components/site/site-nav"
import { SiteFooter } from "@/components/site/site-footer"
import { ScanBox } from "@/components/seo/scan-box"
import { ManualAuditCta } from "@/components/seo/manual-audit-cta"
import { ALL_GUIDES, getGuide, guidePath, relatedGuides } from "@/lib/seo-pages"
import { PLATFORMS } from "@/lib/seo-pages/platforms"
import { breadcrumbSchema } from "@/lib/seo-pages/breadcrumbs"
import { articleSchema, faqPageSchema, jsonLd, SITE_URL } from "@/lib/seo/structured-data"

/**
 * One fix guide per real problem people search for, e.g.
 * /fix/lovable/site-not-indexed-by-google.
 *
 * Statically generated from lib/seo-pages/guides/*. Each record carries its
 * own causes, steps, verification and sources; nothing on the page is a
 * keyword swapped into shared copy. See lib/seo-pages/types.ts for why.
 */

export const dynamicParams = false

export async function generateStaticParams() {
	return ALL_GUIDES.map((g) => ({ platform: g.platform, problem: g.problem }))
}

type Params = Promise<{ platform: string; problem: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
	const { platform, problem } = await params
	const guide = getGuide(platform, problem)
	if (!guide) return {}
	const path = guidePath(guide)
	return {
		alternates: { canonical: `/fix/${guide.platform}/${guide.problem}` },
		title: guide.title,
		description: guide.description,
		openGraph: { title: guide.h1, description: guide.description, url: `${SITE_URL}${path}`, type: "article" },
	}
}

export default async function FixGuidePage({ params }: { params: Params }) {
	const { platform, problem } = await params
	const guide = getGuide(platform, problem)
	if (!guide) notFound()

	const info = PLATFORMS[guide.platform]
	const path = guidePath(guide)
	const related = relatedGuides(guide)
	const crumbs = [
		{ name: "Fix guides", path: "/fix" },
		{ name: info.name, path: `/fix/${info.slug}` },
		{ name: guide.h1, path },
	]

	return (
		<>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{
					__html: jsonLd(
						articleSchema({
							headline: guide.h1,
							description: guide.description,
							url: `${SITE_URL}${path}`,
							datePublished: guide.updated,
						}),
					),
				}}
			/>
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faqPageSchema(guide.faqs)) }} />
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbSchema(crumbs)) }} />
			<SiteNav />
			<main className="bg-white min-h-screen pt-16">
				<article className="max-w-2xl mx-auto px-6 py-14">
					<nav aria-label="Breadcrumb" className="text-[13px] text-[#5b6472] mb-5">
						<Link href="/fix" className="font-semibold text-[#16a34a] hover:underline">
							Fix guides
						</Link>
						<span className="mx-1.5">/</span>
						<Link href={`/fix/${info.slug}`} className="font-semibold text-[#16a34a] hover:underline">
							{info.name}
						</Link>
					</nav>

					<h1 className="text-3xl md:text-4xl font-extrabold leading-tight tracking-tight mb-5 text-[#09111f]">
						{guide.h1}
					</h1>

					<p className="text-[#09111f] text-lg leading-relaxed mb-8 font-medium border-l-4 border-[#22c55e] pl-4">
						{guide.answer}
					</p>

					<ScanBox heading={`Check if your ${info.name === "Any website" ? "site" : info.name + " site"} has this problem`} />

					<h2 className="text-2xl font-bold text-[#09111f] mt-12 mb-3">What you&apos;ll see</h2>
					<p className="text-[#3b4253] leading-relaxed mb-10">{guide.symptom}</p>

					<h2 className="text-2xl font-bold text-[#09111f] mb-5">Why it happens</h2>
					{guide.causes.map((c, i) => (
						<div key={c.title} className="mb-6">
							<h3 className="text-lg font-bold text-[#09111f] mb-1.5">
								{i + 1}. {c.title}
							</h3>
							<p className="text-[#3b4253] leading-relaxed">{c.body}</p>
						</div>
					))}

					<h2 className="text-2xl font-bold text-[#09111f] mt-10 mb-4">How to fix it</h2>
					<ol className="list-decimal pl-6 text-[#3b4253] leading-relaxed space-y-3 mb-8">
						{guide.steps.map((s) => (
							<li key={s}>{s}</li>
						))}
					</ol>

					{guide.prompt ? (
						<div className="mb-10">
							<h3 className="text-lg font-bold text-[#09111f] mb-2">Prompt to paste into {info.name}</h3>
							<pre className="whitespace-pre-wrap bg-[#0f1a2e] text-[#e2e8f0] text-[13.5px] leading-relaxed p-4 overflow-x-auto">
								{guide.prompt}
							</pre>
						</div>
					) : null}

					<h2 className="text-2xl font-bold text-[#09111f] mb-4">How to check it&apos;s fixed</h2>
					<ul className="list-disc pl-6 text-[#3b4253] leading-relaxed space-y-2 mb-10">
						{guide.verify.map((v) => (
							<li key={v}>{v}</li>
						))}
					</ul>

					<div className="bg-[#f5f6f8] border border-[#e3e5ea] p-6 mb-12">
						<h2 className="text-lg font-bold text-[#09111f] mb-3">What a QAlaunch scan shows for this</h2>
						<ul className="list-disc pl-5 text-[14.5px] text-[#3b4253] leading-relaxed space-y-1.5">
							{guide.scanFlags.map((f) => (
								<li key={f}>{f}</li>
							))}
						</ul>
						<p className="mt-4 text-[13px] text-[#5b6472]">
							See exactly what a full report contains in the{" "}
							<Link href="/sample-report" className="font-semibold text-[#16a34a] hover:underline">
								sample report
							</Link>
							.
						</p>
					</div>

					<h2 className="text-2xl font-bold text-[#09111f] mb-4">Frequently asked questions</h2>
					<div className="divide-y divide-[#e3e5ea] mb-12">
						{guide.faqs.map((f) => (
							<div key={f.q} className="py-5">
								<h3 className="font-semibold mb-2 text-[#09111f]">{f.q}</h3>
								<p className="text-sm text-[#5b6472] leading-relaxed">{f.a}</p>
							</div>
						))}
					</div>

					<ManualAuditCta
						context={`If this is a site you're launching or handing to a client, I'll go through it by hand, including the ${info.name === "Any website" ? "" : info.name + "-specific "}issues a scan can't reach, like logged-in flows.`}
					/>

					{related.length > 0 ? (
						<div className="mt-12">
							<h2 className="text-xl font-bold text-[#09111f] mb-3">Related fixes</h2>
							<ul className="space-y-2">
								{related.map((r) => (
									<li key={guidePath(r)}>
										<Link href={guidePath(r)} className="text-[#16a34a] font-semibold hover:underline">
											{r.h1}
										</Link>
									</li>
								))}
							</ul>
						</div>
					) : null}

					<p className="mt-8 text-sm text-[#5b6472]">
						More for {info.name}:{" "}
						<Link href={`/fix/${info.slug}`} className="text-[#16a34a] font-semibold hover:underline">
							all {info.name} fixes
						</Link>
						{info.landing ? (
							<>
								{" · "}
								<Link href={info.landing} className="text-[#16a34a] font-semibold hover:underline">
									{info.name === "Any website" ? "website testing" : `${info.name} testing`}
								</Link>
							</>
						) : null}
						{(info.posts ?? []).map((p) => (
							<span key={p.href}>
								{" · "}
								<Link href={p.href} className="text-[#16a34a] font-semibold hover:underline">
									{p.label}
								</Link>
							</span>
						))}
					</p>

					<div className="mt-10 border-t border-[#e3e5ea] pt-6 text-[13px] text-[#5b6472]">
						<p>
							Written by Waqas Ahmad, QA engineer with 10 years of professional testing experience. Last checked{" "}
							{new Date(guide.updated).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.
						</p>
						<p className="mt-2">
							Sources:{" "}
							{guide.sources.map((s, i) => (
								<span key={s.url}>
									{i > 0 ? " · " : ""}
									<a href={s.url} rel="noopener nofollow" target="_blank" className="underline hover:text-[#09111f]">
										{s.label}
									</a>
								</span>
							))}
						</p>
					</div>
				</article>
			</main>
			<SiteFooter />
		</>
	)
}
