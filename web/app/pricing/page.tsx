import type { Metadata } from 'next';

import { SiteNav } from '@/components/site/site-nav';
import { SiteFooter } from '@/components/site/site-footer';
import { PricingGrid } from '@/components/pricing/pricing-grid';
import { FAQ, type FAQItem } from '@/components/home/faq';

export const metadata: Metadata = {
	title: 'Pricing — QAlaunch Website Audit Reports from $9',
	description:
		'Simple one-time pricing for expert website audit reports. Basic from $9, Standard $24, Premium $59. No subscriptions. PDF delivered instantly.',
};

const pricingFaqs: FAQItem[] = [
	{
		q: 'How long does the full audit take?',
		a: 'The free audit preview takes under 60 seconds. A full paid report is ready within 3–5 minutes of payment. Your PDF download link arrives by email immediately.',
	},
	{
		q: 'What counts as one "page"?',
		a: 'A page is any unique URL — homepage, about, services, pricing, contact, product pages, etc. For the Basic plan you choose 1 page. For Standard, up to 5 pages. You specify which pages you want audited after payment.',
	},
	{
		q: 'Can I send the report to my developer?',
		a: "Absolutely — that's exactly what it's designed for. The PDF report includes step-by-step developer fix instructions for every issue. Your developer can action these immediately without any follow-up questions.",
	},
	{
		q: 'Do you offer refunds?',
		a: 'Yes. If your report fails to generate for any technical reason, you receive a full refund immediately. If you are unsatisfied, contact us within 48 hours and we will review your case. We stand behind every report.',
	},
];

export default function PricingPage() {
	return (
		<>
			<SiteNav />
			<main className='pt-16'>
				{/* Page header */}
				<section className='bg-slate-deep px-5 py-20 text-center md:px-12 md:py-24'>
					<div className='mx-auto max-w-2xl'>
						<h1 className='font-heading mx-auto text-[clamp(2.25rem,5vw,3.25rem)] font-black leading-[1.05] tracking-[-0.025em] text-balance text-white'>
							Simple, one-time pricing
						</h1>
						<p className='mx-auto pt-2 text-[17px] text-white/60'>
							No subscriptions. No surprises. Pay once, get your expert audit
							report instantly.
						</p>
					</div>
				</section>

				<section className='px-5 py-20 md:px-12 md:py-24'>
					<div className='mx-auto max-w-7xl'>
						<PricingGrid />
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
