import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { SiteNav } from "@/components/site/site-nav"
import { SiteFooter } from "@/components/site/site-footer"
import { ScanBox } from "@/components/seo/scan-box"
import { activePlatforms, guidePath, guidesFor } from "@/lib/seo-pages"
import { PLATFORMS } from "@/lib/seo-pages/platforms"
import type { PlatformSlug } from "@/lib/seo-pages/types"
import { breadcrumbSchema } from "@/lib/seo-pages/breadcrumbs"
import { jsonLd } from "@/lib/seo/structured-data"

/** Hub per platform: links every guide in the cluster and the platform's sales page. */

export const dynamicParams = false

export async function generateStaticParams() {
	return activePlatforms().map((p) => ({ platform: p.slug }))
}

type Params = Promise<{ platform: string }>

function lookup(platform: string) {
	return platform in PLATFORMS ? PLATFORMS[platform as PlatformSlug] : undefined
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
	const info = lookup((await params).platform)
	if (!info) return {}
	const title = info.slug === "any-website" ? "Website Problems and Fixes" : `${info.name} Problems and Fixes`
	return {
		alternates: { canonical: `/fix/${info.slug}` },
		title,
		description: `${info.blurb} Step-by-step fixes from a QA engineer, plus a free real-browser scan to check your own site.`,
	}
}

export default async function PlatformHubPage({ params }: { params: Params }) {
	const info = lookup((await params).platform)
	if (!info) notFound()
	const guides = guidesFor(info.slug)
	if (guides.length === 0) notFound()

	return (
		<>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{
					__html: jsonLd(
						breadcrumbSchema([
							{ name: "Fix guides", path: "/fix" },
							{ name: info.name, path: `/fix/${info.slug}` },
						]),
					),
				}}
			/>
			<SiteNav />
			<main className="bg-white min-h-screen pt-16">
				<div className="max-w-2xl mx-auto px-6 py-14">
					<nav aria-label="Breadcrumb" className="text-[13px] text-[#5b6472] mb-5">
						<Link href="/fix" className="font-semibold text-[#16a34a] hover:underline">
							Fix guides
						</Link>
					</nav>
					<h1 className="text-3xl md:text-4xl font-extrabold leading-tight tracking-tight mb-4 text-[#09111f]">
						{info.slug === "any-website" ? "Common website problems and how to fix them" : `${info.name} problems and how to fix them`}
					</h1>
					<p className="text-[#3b4253] text-lg leading-relaxed mb-8">{info.blurb}</p>

					<ul className="divide-y divide-[#e3e5ea] border-y border-[#e3e5ea] mb-10">
						{guides.map((g) => (
							<li key={g.problem} className="py-4">
								<Link href={guidePath(g)} className="font-semibold text-[#09111f] hover:text-[#16a34a]">
									{g.h1}
								</Link>
								<p className="text-sm text-[#5b6472] mt-1 leading-relaxed">{g.description}</p>
							</li>
						))}
					</ul>

					<ScanBox heading="Not sure what's wrong? Scan your site free" />

					{info.landing || info.posts?.length ? (
						<p className="mt-8 text-sm text-[#5b6472]">
							Also see:{" "}
							{info.landing ? (
								<Link href={info.landing} className="text-[#16a34a] font-semibold hover:underline">
									{info.slug === "any-website" ? "website testing" : `${info.name} testing`}
								</Link>
							) : null}
							{(info.posts ?? []).map((p, i) => (
								<span key={p.href}>
									{info.landing || i > 0 ? " · " : ""}
									<Link href={p.href} className="text-[#16a34a] font-semibold hover:underline">
										{p.label}
									</Link>
								</span>
							))}
						</p>
					) : null}
				</div>
			</main>
			<SiteFooter />
		</>
	)
}
