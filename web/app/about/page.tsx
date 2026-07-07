import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteNav } from '@/components/site/site-nav'
import { SiteFooter } from '@/components/site/site-footer'
import { Flag } from '@/components/home/flag'

export const metadata: Metadata = {
  title: 'About QAlaunch — Built by a QA Engineer with 9+ Years Experience',
  description:
    "QAlaunch is built by a non-technical QA engineer with 9+ years of professional testing experience, using AI-assisted development to help website owners find what visitors see that they can't.",
  openGraph: {
    title: 'About QAlaunch — Built by a QA Engineer with 9+ Years Experience',
    description:
      'How a non-technical QA engineer built an AI-powered website audit tool almost entirely through AI-assisted development.',
    url: 'https://getqalaunch.com/about',
  },
}

const STATS = [
  { value: '1,000+', label: 'Websites Audited' },
  { value: '35+', label: 'Quality Checks' },
  { value: '9yr', label: 'QA Expertise' },
]

export default function AboutPage() {
  return (
    <>
      <SiteNav />
      <main className="bg-white pt-16">
        {/* Hero */}
        <section className="relative overflow-hidden bg-slate-deep px-5 py-20 text-center sm:px-8 md:px-12 md:py-24">
          <div className="qa-hero-grid pointer-events-none absolute inset-0" />
          <div className="qa-orb-float pointer-events-none absolute -left-40 -top-40 size-[520px] rounded-full bg-[radial-gradient(circle,rgba(24,71,168,0.45)_0%,transparent_65%)]" />
          <div className="qa-orb-float-alt pointer-events-none absolute -bottom-48 -right-32 size-[460px] rounded-full bg-[radial-gradient(circle,rgba(34,197,94,0.18)_0%,transparent_60%)]" />

          <div className="relative z-10 mx-auto max-w-3xl">
            <div className="mb-6 flex justify-center">
              <Flag>About QAlaunch</Flag>
            </div>
            <h1 className="font-heading text-[clamp(2.25rem,5.2vw,3.5rem)] font-black leading-[1.05] tracking-tight text-balance text-white">
              Built by someone who&apos;s spent 9+ years finding what&apos;s broken.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/65 sm:text-lg">
              QAlaunch exists because most websites ship with bugs nobody catches until a customer hits them.
            </p>
          </div>
        </section>

        {/* Body */}
        <section className="px-5 py-20 md:px-12 md:py-24">
          <div className="mx-auto max-w-3xl">
            <div className="space-y-6 text-base leading-relaxed text-body sm:text-lg">
              <p>
                QAlaunch was founded by a QA engineer with 9+ years of professional software testing
                experience — someone who has spent the better part of a decade finding the bugs that make
                it into production, and figuring out why the processes meant to catch them didn&apos;t.
              </p>
              <p>
                There&apos;s an irony worth naming upfront: the person behind QAlaunch can&apos;t write a line of
                application code. QAlaunch itself was built almost entirely through AI-assisted development
                — Claude Code, prompt by prompt — turning nine years of QA judgment into a product without a
                traditional engineering team.
              </p>
              <p>
                The belief driving all of it: most website bugs aren&apos;t hard to find — they&apos;re just
                invisible to the person who needs to see them. Owners test their own site while logged in, on
                desktop, and already familiar with how everything works. Those are exactly the conditions that
                hide problems from a genuinely new visitor — someone on a phone, with no account, and no idea
                where anything is.
              </p>
              <p>
                QAlaunch closes that gap. It opens any public website in a real cloud browser, runs it through
                automated checks plus AI-powered visual analysis, and hands back a plain-English report — what&apos;s
                broken and where, with no developer jargon and no fix instructions to interpret. It works the
                same way regardless of what built the site — WordPress, Shopify, Webflow, hand-written code, or
                an AI builder like Lovable, Bolt, or Replit. And because most people don&apos;t need an audit every
                week, pricing is one-time, not a subscription — you pay for the audit you actually need, not a
                recurring charge for a tool you&apos;ll use occasionally.
              </p>
            </div>

            {/* Stats */}
            <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-3">
              {STATS.map((s) => (
                <div
                  key={s.label}
                  className="rounded-none border-2 border-slate-deep bg-white p-6 text-center"
                >
                  <div className="font-heading text-4xl font-black leading-none tracking-[-0.02em] text-ink">
                    {s.value}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-body">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden bg-linear-to-br from-brand-dark to-brand px-5 py-20 text-center md:px-12 md:py-24">
          <div className="qa-cta-grid pointer-events-none absolute inset-0" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 h-28 w-20 -translate-x-1/3 -translate-y-1/4 -skew-x-12 bg-accent-bright"
          />
          <div className="relative z-10 mx-auto max-w-2xl">
            <h2 className="font-heading text-[clamp(1.875rem,4vw,2.875rem)] font-black leading-tight tracking-tight text-balance text-white">
              See what QAlaunch finds on your site
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
              Free audit in 120 seconds. No signup needed. Full expert report from just $9.
            </p>
            <Link
              href="/"
              className="mt-10 inline-flex h-14 items-center justify-center gap-2 rounded-none bg-accent-bright px-10 text-sm font-extrabold tracking-wide text-white shadow-glow-accent transition-colors hover:bg-accent-emerald hover:shadow-glow-accent-lg sm:h-[60px] sm:px-12 sm:text-base"
            >
              Audit My Website Free →
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
