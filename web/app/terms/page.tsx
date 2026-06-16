import type { Metadata } from 'next';
import Link from 'next/link';

import { SiteNav } from '@/components/site/site-nav';
import { SiteFooter } from '@/components/site/site-footer';

export const metadata: Metadata = {
	title: 'Terms of Service',
	description:
		'QAlaunch terms of service. Rules and conditions for using our website auditing tool.',
};

export default function TermsPage() {
	return (
		<>
			<SiteNav />
			<main className='pt-16'>
				<LegalHeader title='Terms of Service' />

				<section className='px-5 py-16 md:px-12 md:py-20'>
					<div className='mx-auto max-w-3xl'>
						<LegalSection title='1. Acceptance of Terms'>
							<p>
								By using QAlaunch you agree to these terms. If you do not agree,
								please do not use the service.
							</p>
						</LegalSection>

						<LegalSection title='2. What QAlaunch provides'>
							<ul className='flex list-disc flex-col gap-2 pl-5 marker:text-muted-ink'>
								<li>An automated, AI-powered website auditing service.</li>
								<li>Results are delivered as a PDF report via email.</li>
								<li>
									Scans cover usability, UI bugs, functionality, mobile
									responsiveness, performance, SEO, and accessibility.
								</li>
								<li>
									Results are AI-generated and should be reviewed — they are not
									a substitute for professional technical advice.
								</li>
							</ul>
						</LegalSection>

						<LegalSection title='3. Payments'>
							<ul className='flex list-disc flex-col gap-2 pl-5 marker:text-muted-ink'>
								<li>
									All payments are processed by Paddle.com as the Merchant of
									Record.
								</li>
								<li>
									Prices are in USD: Basic $9 (1 page), Standard $24 (2–5 pages),
									and Premium $59 (6–10 pages).
								</li>
								<li>Payment is one-time per report — there are no subscriptions.</li>
								<li>You will receive a receipt from Paddle after payment.</li>
							</ul>
						</LegalSection>

						<LegalSection title='4. What you are allowed to scan'>
							<ul className='flex list-disc flex-col gap-2 pl-5 marker:text-muted-ink'>
								<li>
									Only websites you own or have explicit written permission to
									scan.
								</li>
								<li>
									You must not use QAlaunch to scan websites without permission.
								</li>
								<li>
									QAlaunch is for public-facing pages only — we do not scan
									password-protected areas.
								</li>
								<li>
									By submitting a URL you confirm you have permission to scan it.
								</li>
							</ul>
						</LegalSection>

						<LegalSection title='5. What we do not guarantee'>
							<ul className='flex list-disc flex-col gap-2 pl-5 marker:text-muted-ink'>
								<li>QAlaunch may not find every issue on your website.</li>
								<li>AI analysis is accurate but not infallible.</li>
								<li>Results may vary between scans of the same site.</li>
								<li>
									We are not responsible for any decisions made based on the
									report.
								</li>
							</ul>
						</LegalSection>

						<LegalSection title='6. Refund policy'>
							<p>
								See our full{' '}
								<Link
									href='/refund'
									className='font-semibold text-brand hover:underline'>
									Refund Policy
								</Link>
								. In summary: if your report failed to generate or was not
								delivered, contact us and we will either resend it or issue a full
								refund.
							</p>
						</LegalSection>

						<LegalSection title='7. Prohibited uses'>
							<ul className='flex list-disc flex-col gap-2 pl-5 marker:text-muted-ink'>
								<li>Do not use QAlaunch to scan websites you do not own.</li>
								<li>
									Do not attempt to reverse engineer, copy, or resell our
									reports.
								</li>
								<li>Do not use automated tools to submit bulk scan requests.</li>
								<li>
									Do not attempt to circumvent the one-free-scan-per-domain
									limit.
								</li>
							</ul>
						</LegalSection>

						<LegalSection title='8. Limitation of liability'>
							<ul className='flex list-disc flex-col gap-2 pl-5 marker:text-muted-ink'>
								<li>QAlaunch is provided &quot;as is&quot;.</li>
								<li>
									We are not liable for any business losses resulting from acting
									on our report recommendations.
								</li>
								<li>
									Our maximum liability is limited to the amount you paid for the
									scan.
								</li>
							</ul>
						</LegalSection>

						<LegalSection title='9. Governing law'>
							<ul className='flex list-disc flex-col gap-2 pl-5 marker:text-muted-ink'>
								<li>These terms are governed by the laws of Pakistan.</li>
								<li>
									Any disputes will be resolved in the courts of Islamabad,
									Pakistan.
								</li>
							</ul>
						</LegalSection>

						<LegalSection title='10. Changes to terms'>
							<ul className='flex list-disc flex-col gap-2 pl-5 marker:text-muted-ink'>
								<li>We may update these terms at any time.</li>
								<li>
									Continued use after changes means you accept the new terms.
								</li>
							</ul>
						</LegalSection>

						<LegalSection title='11. Contact'>
							<p>
								Questions about these terms? Email us at <ContactEmail />.
								QAlaunch is operated from Islamabad, Pakistan.
							</p>
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
			<div className='mt-3 flex flex-col gap-3 text-[15px] leading-relaxed text-body'>
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
