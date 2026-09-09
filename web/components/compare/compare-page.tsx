import type { Metadata } from 'next'
import Link from 'next/link'

import { SiteNav } from '@/components/site/site-nav'
import { SiteFooter } from '@/components/site/site-footer'
import type { CompareConfig } from '@/lib/compare/comparisons'

const SITE = 'https://getqalaunch.com'

export function compareMetadata(cfg: CompareConfig): Metadata {
	return {
		title: cfg.title,
		description: cfg.description,
		alternates: { canonical: `/compare/${cfg.slug}` },
		openGraph: {
			title: cfg.ogTitle,
			description: cfg.ogDescription,
			url: `${SITE}/compare/${cfg.slug}`,
			type: 'article',
		},
	}
}

function structuredData(cfg: CompareConfig) {
	return {
		'@context': 'https://schema.org',
		'@type': 'Article',
		headline: cfg.ogTitle,
		description: cfg.description,
		datePublished: '2026-09-09',
		dateModified: '2026-09-09',
		author: { '@type': 'Organization', name: 'QAlaunch', url: SITE },
		url: `${SITE}/compare/${cfg.slug}`,
	}
}

function Check() {
	return <span aria-hidden="true" className="text-[#16a34a] font-bold">✓</span>
}

export function ComparePage({ config: cfg }: { config: CompareConfig }) {
	return (
		<>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData(cfg)) }}
			/>
			<SiteNav />
			<main className="bg-white min-h-screen pt-16">
				{/* Hero */}
				<section className="bg-[#09111f] text-white pt-20 pb-16 px-6">
					<div className="max-w-3xl mx-auto">
						<div className="inline-flex items-center gap-2 text-[#22c55e] text-xs font-bold tracking-widest uppercase mb-6">
							<span className="w-4 h-0.5 bg-[#22c55e]" />
							QALAUNCH VS {cfg.name.toUpperCase()}
						</div>
						<h1 className="text-4xl md:text-5xl font-extrabold leading-tight tracking-tight mb-5">
							{cfg.headlineLead}
							<br />
							<span className="text-[#22c55e]">{cfg.headlineAccent}</span>
						</h1>
						<p className="text-[#aab3c8] text-lg leading-relaxed max-w-2xl">
							{cfg.summary}
						</p>
					</div>
				</section>

				{/* Intro */}
				<section className="py-16 px-6">
					<div className="max-w-3xl mx-auto">
						{cfg.intro.map((p) => (
							<p key={p.slice(0, 40)} className="text-[#3b4253] leading-relaxed mb-4">
								{p}
							</p>
						))}
					</div>
				</section>

				{/* Comparison table */}
				<section className="py-16 px-6 bg-[#f5f6f8]">
					<div className="max-w-3xl mx-auto">
						<h2 className="text-2xl font-bold mb-6">{cfg.tableHeading}</h2>
						<div className="overflow-x-auto border border-[#e3e5ea] bg-white">
							<table className="w-full text-left">
								<thead className="bg-[#09111f] text-white">
									<tr>
										<th className="px-4 py-3 text-[12px] font-bold uppercase tracking-wider">
											Capability
										</th>
										<th className="px-4 py-3 text-[12px] font-bold uppercase tracking-wider whitespace-nowrap">
											{cfg.name}
										</th>
										<th className="px-4 py-3 text-[12px] font-bold uppercase tracking-wider">
											QAlaunch
										</th>
									</tr>
								</thead>
								<tbody>
									{cfg.rows.map((r, i) => (
										<tr
											key={r.capability}
											className={i % 2 ? 'bg-[#fafbfc]' : 'bg-white'}>
											<td className="px-4 py-3 text-[13.5px] font-semibold text-[#09111f] align-top">
												{r.capability}
											</td>
											<td className="px-4 py-3 text-[13px] text-[#5b6472] align-top">
												{r.them}
											</td>
											<td className="px-4 py-3 text-[13px] text-[#3b4253] align-top">
												{r.us}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				</section>

				{/* Where the alternative wins — stated plainly, on purpose. */}
				<section className="py-16 px-6">
					<div className="max-w-3xl mx-auto">
						<h2 className="text-2xl font-bold mb-6">{cfg.themBetterHeading}</h2>
						<ul className="space-y-4 mb-14">
							{cfg.themBetter.map((item) => (
								<li key={item.slice(0, 40)} className="flex gap-3">
									<span aria-hidden="true" className="text-[#5b6472] font-bold">
										→
									</span>
									<span className="text-[#3b4253] leading-relaxed">{item}</span>
								</li>
							))}
						</ul>

						<h2 className="text-2xl font-bold mb-6">{cfg.usBetterHeading}</h2>
						<ul className="space-y-4">
							{cfg.usBetter.map((item) => (
								<li key={item.slice(0, 40)} className="flex gap-3">
									<Check />
									<span className="text-[#3b4253] leading-relaxed">{item}</span>
								</li>
							))}
						</ul>
					</div>
				</section>

				{/* Use both / how to choose */}
				<section className="py-12 px-6 bg-[#eef6f0] border-y border-[#d1e9d9]">
					<div className="max-w-2xl mx-auto">
						<h2 className="text-xl font-bold mb-3">{cfg.togetherHeading}</h2>
						<p className="text-[#3b4253] leading-relaxed mb-6">{cfg.together}</p>
						<Link
							href="/#audit-input"
							className="inline-block bg-[#09111f] text-white font-bold px-8 py-3 hover:bg-[#1f2c44] transition-colors">
							Run a free scan on your site →
						</Link>
						<p className="text-[#5b6472] text-xs mt-3">
							Free · No signup · Results in ~2 min
						</p>
					</div>
				</section>

				{/* FAQ */}
				<section className="py-16 px-6">
					<div className="max-w-3xl mx-auto">
						<h2 className="text-2xl font-bold mb-8">Frequently asked questions</h2>
						<div className="divide-y divide-[#e3e5ea]">
							{cfg.faqs.map((faq) => (
								<div key={faq.q} className="py-5">
									<div className="font-semibold mb-2">{faq.q}</div>
									<div className="text-sm text-[#5b6472]">{faq.a}</div>
								</div>
							))}
						</div>
						<p className="mt-8 text-sm text-[#5b6472]">
							Read more:{' '}
							{cfg.related.map((r, i) => (
								<span key={r.href}>
									{i > 0 && ', '}
									<Link
										href={r.href}
										className="text-[#16a34a] font-semibold hover:underline">
										{r.label}
									</Link>
								</span>
							))}
							.
						</p>
					</div>
				</section>

				{/* Bottom CTA */}
				<section className="bg-[#09111f] text-white py-16 px-6 text-center">
					<div className="max-w-xl mx-auto">
						<h2 className="text-2xl font-bold mb-3">
							See what your visitors actually get
						</h2>
						<p className="text-[#aab3c8] mb-6">
							Paste your URL. A real browser checks it on desktop and mobile and
							reports back in plain English. Free scan, no signup.
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
