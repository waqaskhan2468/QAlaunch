import type { Metadata } from 'next';

import { SiteNav } from '@/components/site/site-nav';
import { SiteFooter } from '@/components/site/site-footer';
import { PricingGrid } from '@/components/pricing/pricing-grid';
import { formatPackagePrice, plans } from '@/components/pricing/pricing-plans';
import { faqPageSchema, jsonLd, pricingProductSchema } from '@/lib/seo/structured-data';
import { FAQ, type FAQItem } from '@/components/home/faq';
import { FreeVsPaidTable } from '@/components/audit/free-vs-paid';

export const metadata: Metadata = {
	alternates: { canonical: '/pricing' },
title: `Pricing — Website Audit Reports from ${formatPackagePrice('basic')}`,
	description:
		`Simple one-time pricing. Homepage ${formatPackagePrice('basic')}, Small site ${formatPackagePrice('standard')} (up to 5 pages), Whole site ${formatPackagePrice('premium')} (up to 10 pages). No subscriptions. PDF report by email, usually within 5 minutes.`,
};

/**
 * Product + Offer markup, one Offer per self-serve tier, built from the same
 * `plans` array the cards render. The custom "Larger site" tier has no price
 * and is left out rather than marked up as $0.
 */
const productSchema = pricingProductSchema(
	plans.flatMap((p) =>
		p.checkoutPackage
			? [{ name: p.tier, description: p.pages, priceUsd: Number(p.price), path: p.cta.href }]
			: [],
	),
);

const pricingFaqs: FAQItem[] = [
	{
		q: 'How long does the full audit take?',
		a: 'The free preview takes about 2 minutes. A full paid report is usually ready within 5 minutes of payment, and the PDF download link arrives by email as soon as it is.',
	},
	{
		q: 'What counts as one "page"?',
		a: 'A page is any unique URL — homepage, about, services, pricing, contact, product pages and so on. Homepage tests your homepage in full. Small site covers up to 5 pages and Whole site up to 10, chosen automatically from your navigation (home, about, services, contact, products and the like).',
	},
	{
		q: 'Can I send the report to my developer?',
		a: "Yes — that's what it's for. Every issue in the report says what is wrong, why it matters and how to fix it, with a screenshot wherever the scanner could pinpoint the element. You get a PDF and a web link to share.",
	},
	{
		q: 'Do you offer refunds?',
		a: 'Yes. If your report fails to generate for any technical reason, you receive a full refund immediately. If you are unsatisfied, contact us within 48 hours and we will review your case. We stand behind every report.',
	},
];

export default function PricingPage() {
	return (
		<>
			<script type='application/ld+json' dangerouslySetInnerHTML={{ __html: jsonLd(productSchema) }} />
			{/* Built from pricingFaqs — the same array <FAQ /> renders below. */}
			<script type='application/ld+json' dangerouslySetInnerHTML={{ __html: jsonLd(faqPageSchema(pricingFaqs)) }} />
			<SiteNav />
			<main className='pt-16'>
				{/* Page header */}
				<section className='bg-slate-deep px-5 py-20 text-center md:px-12 md:py-24'>
					<div className='mx-auto max-w-2xl'>
						<h1 className='font-heading mx-auto text-[clamp(2.25rem,5vw,3.25rem)] font-black leading-[1.05] tracking-[-0.025em] text-balance text-white'>
							Simple, one-time pricing
						</h1>
						<p className='mx-auto pt-2 text-[17px] text-white/60'>
							No subscriptions. No surprises. Pay once, and your full report
							arrives by email, usually within 5 minutes.
						</p>
					</div>
				</section>

				<section className='px-5 py-20 md:px-12 md:py-24'>
					<div className='mx-auto max-w-7xl'>
						<PricingGrid />
						<FreeVsPaidTable className='mx-auto mt-14 max-w-3xl' />
					</div>
				</section>

				<FAQ
					items={pricingFaqs}
					title='Common questions'
					className='bg-surface-soft'
				/>
			</main>
			<SiteFooter />
		</>
	);
}
