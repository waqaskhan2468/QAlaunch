// app/for-lovable/page.tsx
// Drop this file into your Next.js app at that exact path.
// Uses your existing Tailwind + Hanken Grotesk setup.
// No new dependencies needed.

import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Test Your Lovable Website — Find Frontend Bugs Before Launch | QAlaunch',
  description: 'Free automated QA audit for websites built with Lovable. Find broken links, mobile layout bugs, invisible CTAs, and usability issues in 2 minutes. No signup.',
  openGraph: {
    title: 'Test Your Lovable Website — Find Frontend Bugs Before Launch',
    description: 'Free automated QA audit for websites built with Lovable. Broken links, mobile issues, usability bugs found in 2 minutes.',
    url: 'https://getqalaunch.com/for-lovable',
  },
}

const COMMON_ISSUES = [
  {
    title: 'Navigation links that go nowhere',
    desc: 'Lovable\'s client-side routing looks correct in the builder but breaks on real browsers when users click sub-menu items or dropdown links.',
    severity: 'CRITICAL',
  },
  {
    title: 'CTA buttons invisible on iPhone SE',
    desc: 'Text and button contrast looks fine on your large monitor. On a 375px screen the text can disappear against the background entirely.',
    severity: 'CRITICAL',
  },
  {
    title: 'Contact forms submit with no confirmation',
    desc: 'A form that silently swallows submissions is one of the most common Lovable bugs. Visitors assume it worked — your messages don\'t arrive.',
    severity: 'HIGH',
  },
  {
    title: 'Hero section taller than the screen',
    desc: 'Lovable optimises for a desktop preview pane. The hero often forces mobile visitors to scroll before seeing any content or CTA.',
    severity: 'HIGH',
  },
  {
    title: 'Logo not linked back to homepage',
    desc: 'A surprisingly frequent miss in AI-built sites. When users get lost, clicking the logo is the first thing they try.',
    severity: 'HIGH',
  },
  {
    title: 'External links open in the same tab',
    desc: 'Social and portfolio links built with Lovable often open in-tab, sending visitors away with no obvious way back.',
    severity: 'MEDIUM',
  },
]

const FAQS = [
  {
    q: 'Does QAlaunch test Lovable websites specifically?',
    a: 'Yes. QAlaunch opens your site in a real cloud browser and runs an AI-powered audit across usability, UI/UX, mobile responsiveness, functionality, performance, SEO, and accessibility — exactly the layer above the code that security scanners miss.',
  },
  {
    q: 'Can it find bugs in Supabase or Lovable\'s backend?',
    a: 'QAlaunch tests what a real visitor sees: the frontend. It checks whether your forms work, your links go somewhere, and your page renders correctly on mobile. It does not audit code-level security or your database — those need a separate code review.',
  },
  {
    q: 'Is the free scan really free?',
    a: 'Yes. Paste your URL, get your top issues in about 2 minutes. No account required. Full reports (all pages, PDF) start at $9, one-time.',
  },
  {
    q: 'What if my Lovable site is still in preview mode?',
    a: 'QAlaunch needs a publicly accessible URL. If you\'ve published your Lovable app to a lovable.app subdomain or a custom domain, it works. Preview-only or localhost URLs can\'t be reached.',
  },
  {
    q: 'How is this different from Lovable\'s built-in browser testing?',
    a: 'Lovable\'s browser testing runs inside the builder during development. QAlaunch audits your live, deployed site as a real visitor would experience it — on real devices, with real browser behaviour, outside the builder environment.',
  },
]

export default function ForLovablePage() {
  return (
    <main className="bg-white min-h-screen">

      {/* Hero */}
      <section className="bg-[#09111f] text-white pt-20 pb-16 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 text-[#22c55e] text-xs font-bold tracking-widest uppercase mb-6">
            <span className="w-4 h-0.5 bg-[#22c55e]" />
            FOR LOVABLE BUILDERS
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight tracking-tight mb-5">
            Your Lovable site looks great.<br />
            <span className="text-[#22c55e]">But does it actually work?</span>
          </h1>
          <p className="text-[#aab3c8] text-lg leading-relaxed mb-8 max-w-2xl">
            Lovable builds fast. But the builder preview isn&apos;t the same as a real browser on a real phone. 
            QAlaunch opens your live site in a real cloud browser, runs an AI-powered audit, and tells you 
            exactly what&apos;s broken — mobile issues, broken links, invisible buttons, forms that don&apos;t work — 
            before your visitors find out.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-xl">
            <input
              type="text"
              placeholder="https://your-lovable-app.lovable.app"
              className="flex-1 bg-[#0e1729] border border-[#1f2c44] rounded px-4 py-3 text-white text-sm placeholder:text-[#5c6884] outline-none focus:border-[#22c55e]"
            />
            <Link
              href="/"
              className="bg-[#22c55e] text-[#06140d] font-bold px-6 py-3 text-sm hover:bg-[#16a34a] transition-colors whitespace-nowrap"
            >
              Audit My Lovable Site →
            </Link>
          </div>
          <p className="text-[#5c6884] text-xs mt-3">Free · No signup · Results in ~2 min</p>
        </div>
      </section>

      {/* What security scanners miss */}
      <section className="py-16 px-6 bg-[#f5f6f8]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-3">What security scanners miss — and what breaks your conversions</h2>
          <p className="text-[#5b6472] mb-10">
            There are great tools for auditing Lovable&apos;s backend security — RLS configuration, exposed API keys, 
            auth vulnerabilities. QAlaunch does something different: it audits what your <em>visitors</em> actually 
            experience. The layer where most launch-week bugs hide.
          </p>
          <div className="grid gap-4">
            {COMMON_ISSUES.map((issue) => (
              <div key={issue.title} className="bg-white border border-[#e3e5ea] p-5 flex gap-4">
                <div className={`flex-shrink-0 text-xs font-bold px-2 py-1 h-fit ${
                  issue.severity === 'CRITICAL' ? 'bg-red-50 text-red-600' :
                  issue.severity === 'HIGH' ? 'bg-orange-50 text-orange-600' :
                  'bg-blue-50 text-blue-600'
                }`}>
                  {issue.severity}
                </div>
                <div>
                  <div className="font-semibold text-[#09111f] mb-1">{issue.title}</div>
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
              { n: '1', t: 'Paste your Lovable URL', d: 'Any publicly accessible page — your lovable.app subdomain or custom domain.' },
              { n: '2', t: 'Real browser audit runs', d: 'We open it in a real cloud browser, take desktop and mobile screenshots, and run 35+ automated checks.' },
              { n: '3', t: 'Get your report', d: 'Top issues in the free preview. Full PDF report with every page for $9, one-time.' },
            ].map((s) => (
              <div key={s.n} className="flex gap-4">
                <div className="text-4xl font-extrabold text-[#22c55e] leading-none">{s.n}</div>
                <div>
                  <div className="font-bold mb-1">{s.t}</div>
                  <div className="text-sm text-[#5b6472]">{s.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA mid-page */}
      <section className="py-12 px-6 bg-[#eef6f0] border-y border-[#d1e9d9]">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-xl font-bold mb-2">Try it free on your Lovable site</h2>
          <p className="text-sm text-[#5b6472] mb-5">No account needed. See your top issues in about 2 minutes.</p>
          <Link
            href="/"
            className="inline-block bg-[#09111f] text-white font-bold px-8 py-3 hover:bg-[#1f2c44] transition-colors"
          >
            Start Free Audit →
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-8">Frequently asked questions</h2>
          <div className="divide-y divide-[#e3e5ea]">
            {FAQS.map((faq) => (
              <div key={faq.q} className="py-5">
                <div className="font-semibold mb-2">{faq.q}</div>
                <div className="text-sm text-[#5b6472]">{faq.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-[#09111f] text-white py-16 px-6 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold mb-3">Stop guessing what&apos;s broken</h2>
          <p className="text-[#aab3c8] mb-6">Free scan, no signup. Full report from $9.</p>
          <Link
            href="/"
            className="inline-block bg-[#22c55e] text-[#06140d] font-bold px-8 py-3 hover:bg-[#16a34a] transition-colors"
          >
            Audit My Lovable Website Free →
          </Link>
        </div>
      </section>

    </main>
  )
}
