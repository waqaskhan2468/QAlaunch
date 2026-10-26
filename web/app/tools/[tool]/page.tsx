import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { SiteNav } from "@/components/site/site-nav"
import { SiteFooter } from "@/components/site/site-footer"
import { ScanBox } from "@/components/seo/scan-box"
import { ManualAuditCta } from "@/components/seo/manual-audit-cta"
import { getGuide, guidePath } from "@/lib/seo-pages"
import { TOOLS, getTool } from "@/lib/seo-pages/tools"
import { breadcrumbSchema } from "@/lib/seo-pages/breadcrumbs"
import { faqPageSchema, jsonLd, ORGANIZATION, SITE_URL } from "@/lib/seo/structured-data"

/**
 * Scanner-first landing pages for tool-intent searches ("mobile friendly
 * test", "AI website tester"). The free scan sits above the fold; the copy
 * below explains what it checks and, honestly, what it can't.
 */

export const dynamicParams = false

export async function generateStaticParams() {
	return TOOLS.map((t) => ({ tool: t.slug }))
}

type Params = Promise<{ tool: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
	const tool = getTool((await params).tool)
	if (!tool) return {}
	return {
		alternates: { canonical: `/tools/${tool.slug}` },
		title: tool.title,
		description: tool.description,
		openGraph: { title: tool.h1, description: tool.description, url: `${SITE_URL}/tools/${tool.slug}` },
	}
}

function relatedLink(ref: string) {
	const [platform, problem] = ref.split("/")
	const g = getGuide(platform, problem)
	return g ? { href: guidePath(g), label: g.h1 } : null
}

export default async function ToolPage({ params }: { params: Params }) {
	const tool = getTool((await params).tool)
	if (!tool) notFound()

	const app = {
		"@context": "https://schema.org",
		"@type": "WebApplication",
		name: tool.h1,
		url: `${SITE_URL}/tools/${tool.slug}`,
		applicationCategory: "DeveloperApplication",
		operatingSystem: "Web",
		description: tool.description,
		offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
		provider: ORGANIZATION,
	}
	const related = tool.related.map(relatedLink).filter((x): x is { href: string; label: string } => x !== null)
	const others = TOOLS.filter((t) => t.slug !== tool.slug)

	return (
		<>
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(app) }} />
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faqPageSchema(tool.faqs)) }} />
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{
					__html: jsonLd(
						breadcrumbSchema([
							{ name: "Free tools", path: "/tools" },
							{ name: tool.h1, path: `/tools/${tool.slug}` },
						]),
					),
				}}
			/>
			<SiteNav />
			<main className="bg-white min-h-screen pt-16">
				<section className="bg-[#09111f] text-white px-6 pt-14 pb-12">
					<div className="max-w-2xl mx-auto">
						<nav aria-label="Breadcrumb" className="text-[13px] text-[#8a96ad] mb-4">
							<Link href="/tools" className="font-semibold text-[#22c55e] hover:underline">
								Free tools
							</Link>
						</nav>
						<h1 className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight mb-4">{tool.h1}</h1>
						<p className="text-[#aab3c8] text-lg leading-relaxed mb-8">{tool.lead}</p>
						<ScanBox heading="Enter your website" tone="dark" />
					</div>
				</section>

				<article className="max-w-2xl mx-auto px-6 py-14">
					<p className="text-[#09111f] text-lg leading-relaxed mb-10 font-medium border-l-4 border-[#22c55e] pl-4">
						{tool.answer}
					</p>

					<h2 className="text-2xl font-bold text-[#09111f] mb-5">What it checks</h2>
					<div className="grid gap-4 mb-10">
						{tool.checks.map((c) => (
							<div key={c.title} className="border border-[#e3e5ea] p-5">
								<h3 className="font-bold text-[#09111f] mb-1">{c.title}</h3>
								<p className="text-[14.5px] text-[#3b4253] leading-relaxed">{c.body}</p>
							</div>
						))}
					</div>

					<h2 className="text-2xl font-bold text-[#09111f] mb-4">How to read your results</h2>
					<ul className="list-disc pl-6 text-[#3b4253] leading-relaxed space-y-2 mb-10">
						{tool.reading.map((r) => (
							<li key={r}>{r}</li>
						))}
					</ul>

					<h2 className="text-2xl font-bold text-[#09111f] mb-4">What an automated check can&apos;t tell you</h2>
					<ul className="list-disc pl-6 text-[#3b4253] leading-relaxed space-y-2 mb-10">
						{tool.limits.map((l) => (
							<li key={l}>{l}</li>
						))}
					</ul>

					<p className="text-[14.5px] text-[#3b4253] mb-12">
						Want to see a full report before you scan? Here&apos;s a{" "}
						<Link href="/sample-report" className="font-semibold text-[#16a34a] hover:underline">
							real sample report
						</Link>
						.
					</p>

					<h2 className="text-2xl font-bold text-[#09111f] mb-4">Frequently asked questions</h2>
					<div className="divide-y divide-[#e3e5ea] mb-12">
						{tool.faqs.map((f) => (
							<div key={f.q} className="py-5">
								<h3 className="font-semibold mb-2 text-[#09111f]">{f.q}</h3>
								<p className="text-sm text-[#5b6472] leading-relaxed">{f.a}</p>
							</div>
						))}
					</div>

					<ManualAuditCta context="An automated check covers what a visitor sees on load. For logged-in flows, checkout, or a launch that has to go right, I'll test the site by hand." />

					{related.length > 0 ? (
						<div className="mt-12">
							<h2 className="text-xl font-bold text-[#09111f] mb-3">Related fix guides</h2>
							<ul className="space-y-2">
								{related.map((r) => (
									<li key={r.href}>
										<Link href={r.href} className="text-[#16a34a] font-semibold hover:underline">
											{r.label}
										</Link>
									</li>
								))}
							</ul>
						</div>
					) : null}

					<p className="mt-8 text-sm text-[#5b6472]">
						Other free tools:{" "}
						{others.map((t, i) => (
							<span key={t.slug}>
								{i > 0 ? " · " : ""}
								<Link href={`/tools/${t.slug}`} className="text-[#16a34a] font-semibold hover:underline">
									{t.h1}
								</Link>
							</span>
						))}
					</p>

					<div className="mt-10 border-t border-[#e3e5ea] pt-6 text-[13px] text-[#5b6472]">
						<p>
							Built by Waqas Ahmad, QA engineer with 10 years of professional testing experience. Last checked{" "}
							{new Date(tool.updated).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.
						</p>
						{tool.sources.length > 0 ? (
							<p className="mt-2">
								Sources:{" "}
								{tool.sources.map((s, i) => (
									<span key={s.url}>
										{i > 0 ? " · " : ""}
										<a href={s.url} rel="noopener nofollow" target="_blank" className="underline hover:text-[#09111f]">
											{s.label}
										</a>
									</span>
								))}
							</p>
						) : null}
					</div>
				</article>
			</main>
			<SiteFooter />
		</>
	)
}
