import type { Metadata } from 'next';
import Link from 'next/link';

import { SiteNav } from '@/components/site/site-nav';
import { SiteFooter } from '@/components/site/site-footer';

export const metadata: Metadata = {
	title: 'Refund Policy',
	description:
		'QAlaunch refund policy. We stand behind every report — full refunds available if your report fails to generate or is not delivered.',
};

export default function RefundPage() {
	return (
		<>
			<SiteNav />
			<main className='pt-16'>
				<LegalHeader title='Refund Policy' />

				<section className='px-5 py-16 md:px-12 md:py-20'>
					<div className='mx-auto max-w-3xl'>
						<LegalSection title='1. Our commitment'>
							<ul className='flex list-disc flex-col gap-2 pl-5 marker:text-muted-ink'>
								<li>We stand behind the quality of every QAlaunch report.</li>
								<li>
									If something went wrong with your order, we will make it right.
								</li>
							</ul>
						</LegalSection>

						<LegalSection title='2. When you qualify for a refund or rescan'>
							<Scenario
								label='Scenario A — Report not received'
								points={[
									<>
										If you paid but did not receive your PDF report by email
										within 30 minutes, contact us at <ContactEmail /> with your
										order ID.
									</>,
									'We will first check and resend the report.',
									'If we cannot deliver the report, we will issue a full refund.',
								]}
							/>
							<Scenario
								label='Scenario B — Report generation failed'
								points={[
									'If the scan failed to complete due to a technical error on our side.',
									'We will offer a free rescan of the same website.',
									'If the rescan also fails, we will issue a full refund.',
								]}
							/>
							<Scenario
								label='Scenario C — Wrong website scanned'
								points={[
									'If you submitted the wrong URL by mistake, contact us immediately.',
									'If the scan has not completed yet, we will cancel and refund.',
									'If the scan completed, we will offer a discounted rescan of the correct URL.',
								]}
							/>
							<Scenario
								label='Scenario D — Report does not reflect the website'
								points={[
									'If the report content appears to be for a completely different website.',
									'We will investigate and issue a free rescan or full refund.',
								]}
							/>
						</LegalSection>

						<LegalSection title='3. What refunds do not cover'>
							<ul className='flex list-disc flex-col gap-2 pl-5 marker:text-muted-ink'>
								<li>Change of mind after a successful report is delivered.</li>
								<li>Disagreement with the issues found in the report.</li>
								<li>Issues that were fixed before you read the report.</li>
								<li>Reports that were successfully delivered and opened.</li>
							</ul>
						</LegalSection>

						<LegalSection title='4. How to request a refund'>
							<ol className='flex list-decimal flex-col gap-2 pl-5 marker:font-semibold marker:text-muted-ink'>
								<li>
									Email <ContactEmail />.
								</li>
								<li>
									Use the subject line:{' '}
									<span className='font-mono text-[13.5px] text-ink'>
										&quot;Refund Request - [your order ID]&quot;
									</span>
									.
								</li>
								<li>
									Include your order ID (from your Paddle receipt), the website
									URL you scanned, and a brief description of the issue.
								</li>
								<li>We will respond within 1 business day.</li>
								<li>
									Approved refunds are processed within 5–7 business days.
								</li>
								<li>
									Refunds go back to your original payment method via Paddle.
								</li>
							</ol>
						</LegalSection>

						<LegalSection title='5. Contact for refund requests'>
							<ul className='flex list-disc flex-col gap-2 pl-5 marker:text-muted-ink'>
								<li>
									Email: <ContactEmail />
								</li>
								<li>Response time: within 1 business day.</li>
							</ul>
							<p className='text-sm text-muted-ink'>Last updated: June 2026</p>
						</LegalSection>
					</div>
				</section>
			</main>
			<SiteFooter />
		</>
	);
}

// ─── Shared legal-page layout helpers ──────────────────────────────────────────

function Scenario({
	label,
	points,
}: {
	label: string;
	points: React.ReactNode[];
}) {
	return (
		<div className='rounded-2xl border border-border-soft bg-surface-soft p-5 md:p-6'>
			<h3 className='font-heading text-base font-extrabold text-ink md:text-lg'>
				{label}
			</h3>
			<ul className='mt-3 flex list-disc flex-col gap-2 pl-5 marker:text-muted-ink'>
				{points.map((point, i) => (
					<li key={i}>{point}</li>
				))}
			</ul>
		</div>
	);
}

function LegalHeader({ title }: { title: string }) {
	return (
		<section className='bg-slate-deep px-5 py-14 md:px-12 md:py-16'>
			<div className='mx-auto max-w-3xl'>
				<Link
					href='/'
					className='inline-flex items-center gap-1.5 text-[13px] font-medium text-white/60 transition-colors hover:text-white'>
					<span aria-hidden='true'>←</span> Back to Home
				</Link>
				<h1 className='mt-5 font-heading text-[clamp(2rem,4.5vw,2.75rem)] font-black leading-[1.05] tracking-[-0.025em] text-white'>
					{title}
				</h1>
				<p className='mt-2 text-[14px] text-white/55'>Last updated: June 2026</p>
			</div>
		</section>
	);
}

function LegalSection({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<div className='mt-10 first:mt-0'>
			<h2 className='font-heading text-xl font-black tracking-tight text-ink md:text-2xl'>
				{title}
			</h2>
			<div className='mt-3 flex flex-col gap-4 text-[15px] leading-relaxed text-body'>
				{children}
			</div>
		</div>
	);
}

function ContactEmail() {
	return (
		<a
			href='mailto:contact@getqalaunch.com'
			className='font-semibold text-brand hover:underline'>
			contact@getqalaunch.com
		</a>
	);
}
