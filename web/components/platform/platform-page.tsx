import type { Metadata } from 'next'
import Link from 'next/link'

import { SiteNav } from '@/components/site/site-nav'
import { SiteFooter } from '@/components/site/site-footer'
import type { PlatformConfig } from '@/lib/platform/platforms'

const SITE = 'https://getqalaunch.com'

/** Page metadata for a platform landing page. */
export function platformMetadata(cfg: PlatformConfig): Metadata {
	return {
		title: cfg.title,
		description: cfg.description,
		alternates: { canonical: `/${cfg.slug}` },
		openGraph: {
			title: cfg.ogTitle,
			description: cfg.ogDescription,
			url: `${SITE}/${cfg.slug}`,
		},
	}
}

/**
 * SoftwareApplication schema. Mirrors the existing platform pages: no
 * aggregateRating, because there is no verified review data to base one on.
 */
function structuredData(cfg: PlatformConfig) {
	return {
		'@context': 'https://schema.org',
		'@type': 'SoftwareApplication',
		name: 'QAlaunch',
		applicationCategory: 'BusinessApplication',
		applicationSubCategory: 'Website Audit & QA Testing Tool',
		operatingSystem: 'Web',
		url: `${SITE}/${cfg.slug}`,
		description: cfg.description,
		offers: {
			'@type': 'AggregateOffer',
			priceCurrency: 'USD',
			lowPrice: '9',
			highPrice: '59',
			offerCount: '3',
		},
		creator: { '@type': 'Organization', name: 'QAlaunch', url: SITE },
	}
}

const SEVERITY_STYLE: Record<string, string> = {
	CRITICAL: 'bg-red-50 text-red-600',
	HIGH: 'bg-orange-50 text-orange-600',
	MEDIUM: 'bg-blue-50 text-blue-600',
}

export function PlatformPage({ config: cfg }: { config: PlatformConfig }) {
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
							{cfg.eyebrow}
						</div>
						<h1 className="text-4xl md:text-5xl font-extrabold leading-tight tracking-tight mb-5">
							{cfg.headlineLead}
							<br />
							<span className="text-[#22c55e]">{cfg.headlineAccent}</span>
						</h1>
						<p className="text-[#aab3c8] text-lg leading-relaxed mb-8 max-w-2xl">
							{cfg.intro}
						</p>
						<Link
							href="/#audit-input"
							className="inline-block bg-[#22c55e] text-[#06140d] font-bold px-6 py-3 text-sm hover:bg-[#16a34a] transition-colors whitespace-nowrap">
							Audit My Website Free →
						</Link>
						<p className="text-[#5c6884] text-xs mt-3">{cfg.heroNote}</p>
					</div>
				</section>

				{/* Common issues */}
				<section className="py-16 px-6 bg-[#f5f6f8]">
					<div className="max-w-3xl mx-auto">
						<h2 className="text-2xl font-bold mb-3">{cfg.issuesHeading}</h2>
						<p className="text-[#5b6472] mb-10">{cfg.issuesIntro}</p>
						<div className="grid gap-4">
							{cfg.issues.map((issue) => (
								<div
									key={issue.title}
									className="bg-white border border-[#e3e5ea] p-5 flex gap-4">
									<div
										className={`flex-shrink-0 text-xs font-bold px-2 py-1 h-fit ${
											SEVERITY_STYLE[issue.severity] ?? SEVERITY_STYLE.MEDIUM
										}`}>
										{issue.severity}
									</div>
									<div>
										<div className="font-semibold text-[#09111f] mb-1">
											{issue.title}
										</div>
										<div className="text-sm text-[#5b6472]">{issue.desc}</div>
									</div>
								</div>
							))}
						</div>
					</div>
				</section>

				{/* How it works */}
				<section className="py-16 px-6">
					<div className="max-w-3xl mx-auto">
						<h2 className="text-2xl font-bold mb-10">How it works</h2>
						<div className="grid md:grid-cols-3 gap-8">
							{[
								{ n: '1', t: `Paste your ${cfg.name} URL`, d: cfg.step1 },
								{
									n: '2',
									t: 'Real browser audit runs',
									d: 'We open it in a real cloud browser, take desktop and mobile screenshots, and run 35+ automated checks plus an AI visual review.',
								},
								{
									n: '3',
									t: 'Get your report',
									d: 'Top issues in the free preview. Full report with every page from $9, one-time.',
								},
							].map((s) => (
								<div key={s.n} className="flex gap-4">
									<div className="text-4xl font-extrabold text-[#22c55e] leading-none">
										{s.n}
									</div>
									<div>
										<div className="font-bold mb-1">{s.t}</div>
										<div className="text-sm text-[#5b6472]">{s.d}</div>
									</div>
								</div>
							))}
						</div>
					</div>
				</section>

				{/* Mid CTA */}
				<section className="py-12 px-6 bg-[#eef6f0] border-y border-[#d1e9d9]">
					<div className="max-w-xl mx-auto text-center">
						<h2 className="text-xl font-bold mb-2">{cfg.midCtaHeading}</h2>
						<p className="text-sm text-[#5b6472] mb-5">
							No account needed. See your top issues in about 2 minutes.
						</p>
						<Link
							href="/#audit-input"
							className="inline-block bg-[#09111f] text-white font-bold px-8 py-3 hover:bg-[#1f2c44] transition-colors">
							Start Free Audit →
						</Link>
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
						{cfg.related.length > 0 && (
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
						)}
					</div>
				</section>

				{/* Bottom CTA */}
				<section className="bg-[#09111f] text-white py-16 px-6 text-center">
					<div className="max-w-xl mx-auto">
						<h2 className="text-2xl font-bold mb-3">{cfg.bottomCtaHeading}</h2>
						<p className="text-[#aab3c8] mb-6">
							Free scan, no signup. Full report from $9.
						</p>
						<Link
							href="/#audit-input"
							className="inline-block bg-[#22c55e] text-[#06140d] font-bold px-8 py-3 hover:bg-[#16a34a] transition-colors">
							{cfg.bottomCtaButton}
						</Link>
					</div>
				</section>
			</main>
			<SiteFooter />
		</>
	)
}
