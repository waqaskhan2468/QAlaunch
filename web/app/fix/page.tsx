import type { Metadata } from "next"
import Link from "next/link"

import { SiteNav } from "@/components/site/site-nav"
import { SiteFooter } from "@/components/site/site-footer"
import { ScanBox } from "@/components/seo/scan-box"
import { activePlatforms, guidePath, guidesFor } from "@/lib/seo-pages"

export const metadata: Metadata = {
	alternates: { canonical: "/fix" },
	title: "Website Fix Guides by Platform",
	description:
		"Step-by-step fixes for broken forms, blank pages, mobile layout bugs and indexing problems on Lovable, Bolt, Shopify, WordPress and more, from a QA engineer.",
}

export default function FixIndexPage() {
	const platforms = activePlatforms()
	return (
		<>
			<SiteNav />
			<main className="bg-white min-h-screen pt-16">
				<div className="max-w-3xl mx-auto px-6 py-14">
					<h1 className="text-3xl md:text-4xl font-extrabold leading-tight tracking-tight mb-4 text-[#09111f]">
						Website fix guides
					</h1>
					<p className="text-[#3b4253] text-lg leading-relaxed mb-8 max-w-2xl">
						The problems we see most when testing real sites, grouped by what the site is built with. Each guide
						explains the cause, the fix, and how to check it worked.
					</p>
					<div className="mb-12">
						<ScanBox heading="Or find your site's problems in two minutes" />
					</div>
					<div className="grid gap-10 md:grid-cols-2">
						{platforms.map((p) => (
							<section key={p.slug}>
								<h2 className="text-xl font-bold text-[#09111f] mb-3">
									<Link href={`/fix/${p.slug}`} className="hover:text-[#16a34a]">
										{p.name}
									</Link>
								</h2>
								<ul className="space-y-2 text-[15px]">
									{guidesFor(p.slug).map((g) => (
										<li key={g.problem}>
											<Link href={guidePath(g)} className="text-[#16a34a] hover:underline">
												{g.h1}
											</Link>
										</li>
									))}
								</ul>
							</section>
						))}
					</div>
				</div>
			</main>
			<SiteFooter />
		</>
	)
}
