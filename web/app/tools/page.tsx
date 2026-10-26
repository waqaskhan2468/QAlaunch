import type { Metadata } from "next"
import Link from "next/link"

import { SiteNav } from "@/components/site/site-nav"
import { SiteFooter } from "@/components/site/site-footer"
import { TOOLS } from "@/lib/seo-pages/tools"

export const metadata: Metadata = {
	alternates: { canonical: "/tools" },
	title: "Free Website Testing Tools",
	description:
		"Free real-browser website checks: mobile-friendly test, form tester, broken button and link checker, and an AI website tester. No signup.",
}

export default function ToolsIndexPage() {
	return (
		<>
			<SiteNav />
			<main className="bg-white min-h-screen pt-16">
				<div className="max-w-3xl mx-auto px-6 py-14">
					<h1 className="text-3xl md:text-4xl font-extrabold leading-tight tracking-tight mb-4 text-[#09111f]">
						Free website testing tools
					</h1>
					<p className="text-[#3b4253] text-lg leading-relaxed mb-10 max-w-2xl">
						Every tool runs the same real-browser scan: your site opened on desktop and phone, clicked through like a
						visitor would. Pick the one that matches what you&apos;re worried about.
					</p>
					<div className="grid gap-4 md:grid-cols-2">
						{TOOLS.map((t) => (
							<Link key={t.slug} href={`/tools/${t.slug}`} className="block border border-[#e3e5ea] p-5 hover:border-[#16a34a]">
								<h2 className="font-bold text-[#09111f] mb-1">{t.h1}</h2>
								<p className="text-sm text-[#5b6472] leading-relaxed">{t.description}</p>
							</Link>
						))}
					</div>
					<p className="mt-10 text-sm text-[#5b6472]">
						Looking for a specific problem? Browse the{" "}
						<Link href="/fix" className="text-[#16a34a] font-semibold hover:underline">
							fix guides
						</Link>
						.
					</p>
				</div>
			</main>
			<SiteFooter />
		</>
	)
}
