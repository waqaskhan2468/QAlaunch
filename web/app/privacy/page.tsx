import type { Metadata } from 'next';
import Link from 'next/link';

import { SiteNav } from '@/components/site/site-nav';
import { SiteFooter } from '@/components/site/site-footer';

export const metadata: Metadata = {
	title: 'Privacy Policy',
	description:
		'QAlaunch privacy policy. Learn how we collect, use, and protect your data.',
};

export default function PrivacyPage() {
	return (
		<>
			<SiteNav />
			<main className='pt-16'>
				<LegalHeader title='Privacy Policy' />

				<section className='px-5 py-16 md:px-12 md:py-20'>
					<div className='mx-auto max-w-3xl'>
						<LegalSection title='1. Introduction'>
							<p>
								QAlaunch is committed to protecting your privacy. We are an
								AI-powered website auditing tool that scans websites and delivers
								a PDF report identifying usability issues, UI bugs, broken
								functionality, mobile responsiveness problems, and SEO issues.
							</p>
							<p>
								This policy explains what data we collect, how we use it, and the
								choices you have. It applies to your use of getqalaunch.com and
								the QAlaunch service.
							</p>
						</LegalSection>

						<LegalSection title='2. What data we collect'>
							<ul className='flex list-disc flex-col gap-2 pl-5 marker:text-muted-ink'>
								<li>Website URLs you submit for scanning.</li>
								<li>Email addresses you provide for report delivery.</li>
								<li>
									Payment information, which is processed by Paddle — we never
									see or store your card details.
								</li>
								<li>
									Basic usage data, such as pages visited and your scan history.
								</li>
							</ul>
						</LegalSection>

						<LegalSection title='3. How we use your data'>
							<ul className='flex list-disc flex-col gap-2 pl-5 marker:text-muted-ink'>
								<li>To run the website audit and generate your PDF report.</li>
								<li>To email you the report you paid for.</li>
								<li>To improve our scanning accuracy and AI analysis.</li>
								<li>We do not sell your data to anyone.</li>
							</ul>
						</LegalSection>

						<LegalSection title='4. Third-party services we use'>
							<p>
								We rely on a small number of trusted service providers to deliver
								QAlaunch. Each processes only the data needed for its function:
							</p>
							<ul className='flex list-disc flex-col gap-2.5 pl-5 marker:text-muted-ink'>
								<li>
									<strong className='font-semibold text-ink'>
										Paddle (paddle.com)
									</strong>{' '}
									— payment processing. Paddle&apos;s own privacy policy applies
									to all payment data.
								</li>
								<li>
									<strong className='font-semibold text-ink'>Supabase</strong> —
									database and file storage for scan data and reports.
								</li>
								<li>
									<strong className='font-semibold text-ink'>
										Anthropic Claude
									</strong>{' '}
									— AI analysis of scanned pages.
								</li>
								<li>
									<strong className='font-semibold text-ink'>Browserbase</strong>{' '}
									— headless browser used for taking website screenshots.
								</li>
								<li>
									<strong className='font-semibold text-ink'>Resend</strong> —
									email delivery of PDF reports.
								</li>
								<li>
									<strong className='font-semibold text-ink'>
										Google PageSpeed Insights
									</strong>{' '}
									— performance scoring.
								</li>
								<li>
									<strong className='font-semibold text-ink'>Vercel</strong> —
									website hosting.
								</li>
							</ul>
						</LegalSection>

						<LegalSection title='5. Data retention'>
							<ul className='flex list-disc flex-col gap-2 pl-5 marker:text-muted-ink'>
								<li>
									Scan data and reports are stored for 90 days, then deleted.
								</li>
								<li>
									Email addresses are not added to any mailing list unless you
									opt in.
								</li>
								<li>
									You can request deletion of your data at any time by emailing{' '}
									<ContactEmail />.
								</li>
							</ul>
						</LegalSection>

						<LegalSection title='6. Cookies'>
							<ul className='flex list-disc flex-col gap-2 pl-5 marker:text-muted-ink'>
								<li>We use minimal cookies for session management only.</li>
								<li>We do not use advertising or tracking cookies.</li>
							</ul>
						</LegalSection>

						<LegalSection title='7. Your rights'>
							<ul className='flex list-disc flex-col gap-2 pl-5 marker:text-muted-ink'>
								<li>The right to access your data.</li>
								<li>The right to deletion.</li>
								<li>The right to correction.</li>
								<li>
									Contact <ContactEmail /> for any requests.
								</li>
							</ul>
						</LegalSection>

						<LegalSection title='8. Contact'>
							<p>
								Questions about this policy or your data? Email us at{' '}
								<ContactEmail />. QAlaunch is operated from Islamabad, Pakistan.
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
