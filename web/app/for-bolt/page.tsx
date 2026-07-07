// app/for-bolt/page.tsx

import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteNav } from '@/components/site/site-nav'
import { SiteFooter } from '@/components/site/site-footer'

export const metadata: Metadata = {
  title: 'Test Your Bolt.new Website — Find Bugs Before Launch | QAlaunch',
  description: 'Free automated QA audit for websites built with Bolt.new. Find mobile layout bugs, broken buttons, invisible CTAs, and usability issues in 2 minutes. No signup.',
  openGraph: {
    title: 'Test Your Bolt.new Website — Find Bugs Before Launch',
    description: 'Free automated QA audit for sites built with Bolt.new. Mobile bugs, broken links, usability issues found in 2 minutes.',
    url: 'https://getqalaunch.com/for-bolt',
  },
}

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'QAlaunch',
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'Website Audit & QA Testing Tool',
  operatingSystem: 'Web',
  url: 'https://getqalaunch.com/for-bolt',
  description:
    'Free automated QA audit for websites built with Bolt.new. Find mobile layout bugs, broken buttons, invisible CTAs, and usability issues in 2 minutes. No signup.',
  offers: {
    '@type': 'AggregateOffer',
    priceCurrency: 'USD',
    lowPrice: '9',
    highPrice: '59',
    offerCount: '3',
  },
  creator: {
    '@type': 'Organization',
    name: 'QAlaunch',
    url: 'https://getqalaunch.com',
  },
}

const COMMON_ISSUES = [
  {
    title: 'Drag-and-drop features that break in Safari',
    desc: 'Bolt previews in Chrome. Safari handles JavaScript events differently. Interactions that work perfectly during build break silently on a huge share of mobile visitors.',
    severity: 'CRITICAL',
  },
  {
    title: 'Buttons with text that disappears on click',
    desc: 'A common Bolt output bug: the button hover or active state causes the text to inherit a transparent color, making the label vanish mid-interaction.',
    severity: 'CRITICAL',
  },
  {
    title: '"View all" links pointing back to the homepage',
    desc: 'A very frequent AI builder miss. Explore or View All CTAs quietly resolve to / instead of the intended collection or category page.',
    severity: 'HIGH',
  },
  {
    title: 'Hero banner forces scrolling before any content',
    desc: 'Bolt optimises what it shows in the in-browser IDE. On a real phone the hero can take up 150%+ of the viewport, pushing your CTA and value prop out of sight.',
    severity: 'HIGH',
  },
  {
    title: 'Navigation disappears when scrolling down',
    desc: 'Sticky nav that works in the Bolt preview can lose its positioning on real devices, especially when the viewport height changes dynamically.',
    severity: 'HIGH',
  },
  {
    title: 'No active state on current nav item',
    desc: 'Visitors can\'t tell what page they\'re on. Small thing, but it undermines trust and increases bounce when users feel disoriented.',
    severity: 'MEDIUM',
  },
]

const FAQS = [
  {
    q: 'Does QAlaunch work on Bolt.new websites?',
    a: 'Yes. QAlaunch works on any publicly accessible website regardless of how it was built — Bolt.new, Lovable, Replit, WordPress, Shopify, or custom code. If it has a URL, we can audit it.',
  },
  {
    q: 'What does it check that Bolt\'s own preview doesn\'t?',
    a: 'Bolt\'s preview runs inside its own browser environment. QAlaunch opens your live, deployed site in a real cloud browser and tests it the way actual visitors experience it — on real device widths, with real browser rendering, outside the IDE. That\'s where most bugs hide.',
  },
  {
    q: 'How long does the free audit take?',
    a: 'About 2 minutes for your homepage. No account or signup needed to see your top issues.',
  },
  {
    q: 'What does the paid report include?',
    a: 'The full report covers every page you choose (1 page for $9, 2-5 pages for $24, 6-10 pages for $59), delivered as a PDF by email. One-time purchase, no subscription.',
  },
  {
    q: 'Can it find security issues in my Bolt app?',
    a: 'QAlaunch tests the frontend — what visitors see. It does not audit backend security, API endpoints, or database configuration. For code-level security, you\'d need a separate code review tool.',
  },
]

export default function ForBoltPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    <SiteNav />
      <main className="bg-white min-h-screen pt-16">

      <section className="bg-[#09111f] text-white pt-20 pb-16 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 text-[#22c55e] text-xs font-bold tracking-widest uppercase mb-6">
            <span className="w-4 h-0.5 bg-[#22c55e]" />
            FOR BOLT.NEW BUILDERS
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight tracking-tight mb-5">
            Bolt builds it fast.<br />
            <span className="text-[#22c55e]">QAlaunch checks it works.</span>
          </h1>
          <p className="text-[#aab3c8] text-lg leading-relaxed mb-8 max-w-2xl">
            The Bolt.new IDE preview isn&apos;t the same as a real visitor on a real phone. 
            Features that look fine in Chrome can break in Safari. Mobile layouts that seem correct 
            at your desk fall apart at 375px. QAlaunch catches these before your users do.
          </p>
          <Link
            href="/#audit-input"
            className="inline-block bg-[#22c55e] text-[#06140d] font-bold px-6 py-3 text-sm hover:bg-[#16a34a] transition-colors whitespace-nowrap"
          >
            Audit My Website Free →
          </Link>
          <p className="text-[#5c6884] text-xs mt-3">Free · No signup · Results in ~2 min</p>
        </div>
      </section>

      <section className="py-16 px-6 bg-[#f5f6f8]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-3">Common bugs found in Bolt.new websites</h2>
          <p className="text-[#5b6472] mb-10">
            These are the issues we find most often when auditing sites built with Bolt. 
            None of them show up in the builder preview — they only appear on a real browser, on a real device.
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

      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-10">How it works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { n: '1', t: 'Paste your deployed URL', d: 'The live URL where your Bolt site is hosted — stackblitz.io, your own domain, wherever it\'s deployed.' },
              { n: '2', t: 'Real browser audit', d: 'A real cloud browser opens your site, takes desktop + mobile screenshots, and runs 35+ automated checks.' },
              { n: '3', t: 'Plain-English report', d: 'Top issues shown free. Full report with every page, delivered as PDF, from $9 one-time.' },
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

      <section className="py-12 px-6 bg-[#eef6f0] border-y border-[#d1e9d9]">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-xl font-bold mb-2">Try it free on your Bolt.new site</h2>
          <p className="text-sm text-[#5b6472] mb-5">No account needed. See your top issues in about 2 minutes.</p>
          <Link href="/#audit-input" className="inline-block bg-[#09111f] text-white font-bold px-8 py-3 hover:bg-[#1f2c44] transition-colors">
            Start Free Audit →
          </Link>
        </div>
      </section>

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

      <section className="bg-[#09111f] text-white py-16 px-6 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold mb-3">Find what&apos;s broken before your users do</h2>
          <p className="text-[#aab3c8] mb-6">Free scan, no signup. Full report from $9.</p>
          <Link href="/#audit-input" className="inline-block bg-[#22c55e] text-[#06140d] font-bold px-8 py-3 hover:bg-[#16a34a] transition-colors">
            Audit My Bolt Website Free →
          </Link>
        </div>
      </section>

    </main>
      <SiteFooter />
    </>
  )
}
