import type { Metadata } from 'next'
import Link from 'next/link'

import { SiteNav } from '@/components/site/site-nav'
import { SiteFooter } from '@/components/site/site-footer'
import { COMPARISONS } from '@/lib/compare/comparisons'

export const metadata: Metadata = {
	title: 'How QAlaunch Compares to the Alternatives',
	description:
		'Honest comparisons against Google Lighthouse, hiring a QA tester, and BrowserStack — including where each of them is the better choice.',
	alternates: { canonical: '/compare' },
	openGraph: {
		title: 'How QAlaunch Compares to the Alternatives',
		description:
			'Where QAlaunch fits against Lighthouse, a freelance QA tester, and BrowserStack — and where it does not.',
		url: 'https://getqalaunch.com/compare',
	},
}

export default function ComparePage() {
	return (
		<>
			<SiteNav />
			<main className="bg-white min-h-screen pt-16">
				<section className="bg-[#09111f] text-white pt-20 pb-16 px-6">
					<div className="max-w-3xl mx-auto">
						<div className="inline-flex items-center gap-2 text-[#22c55e] text-xs font-bold tracking-widest uppercase mb-6">
							<span className="w-4 h-0.5 bg-[#22c55e]" />
							COMPARISONS
						</div>
						<h1 className="text-4xl md:text-5xl font-extrabold leading-tight tracking-tight mb-5">
							How QAlaunch compares
							<br />
							<span className="text-[#22c55e]">— including where it loses.</span>
						</h1>
						<p className="text-[#aab3c8] text-lg leading-relaxed max-w-2xl">
							QAlaunch does one thing: it opens your live site as an anonymous
							visitor, on desktop and phone, and reports what is broken in plain
							English. Plenty of tools do other things better. Each comparison
							below says plainly when you should use something else.
						</p>
					</div>
				</section>

				<section className="py-16 px-6">
					<div className="max-w-3xl mx-auto grid gap-4">
						{COMPARISONS.map((c) => (
							<Link
								key={c.slug}
								href={`/compare/${c.slug}`}
								className="block border-2 border-[#09111f] bg-white p-6 transition-colors hover:border-[#22c55e]">
								<div className="font-bold text-lg text-[#09111f] mb-2">
									QAlaunch vs {c.name}
								</div>
								<p className="text-sm text-[#5b6472] leading-relaxed">
									{c.description}
								</p>
								<span className="mt-3 inline-block text-sm font-semibold text-[#16a34a]">
									Read the comparison →
								</span>
							</Link>
						))}
					</div>
				</section>

				<section className="bg-[#09111f] text-white py-16 px-6 text-center">
					<div className="max-w-xl mx-auto">
						<h2 className="text-2xl font-bold mb-3">Or just try it on your site</h2>
						<p className="text-[#aab3c8] mb-6">
							Two minutes, no signup, and you will see for yourself what it catches.
						</p>
						<Link
							href="/#audit-input"
							className="inline-block bg-[#22c55e] text-[#06140d] font-bold px-8 py-3 hover:bg-[#16a34a] transition-colors">
							Audit My Website Free →
						</Link>
					</div>
				</section>
			</main>
			<SiteFooter />
		</>
	)
}
