// app/for-wordpress/page.tsx

import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteNav } from '@/components/site/site-nav'
import { SiteFooter } from '@/components/site/site-footer'

export const metadata: Metadata = {
  title: 'Check Your WordPress Site for Bugs & Issues | QAlaunch',
  description: 'Free automated audit for WordPress websites. Find broken links, mobile layout problems, plugin conflicts visible to visitors, and usability issues — in 2 minutes, no signup.',
  openGraph: {
    title: 'Check Your WordPress Site for Bugs & Issues',
    description: 'Free automated audit for WordPress sites. Broken links, mobile issues, and usability problems found in 2 minutes.',
    url: 'https://getqalaunch.com/for-wordpress',
  },
}

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'QAlaunch',
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'Website Audit & QA Testing Tool',
  operatingSystem: 'Web',
  url: 'https://getqalaunch.com/for-wordpress',
  description:
    'Free automated audit for WordPress websites. Find broken links, mobile layout problems, plugin conflicts visible to visitors, and usability issues — in 2 minutes, no signup.',
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
    title: 'Dropdown menus that confuse instead of guide',
    desc: 'Theme and menu-plugin combinations often render dropdown icons detached from their menu items, so visitors don\'t realise a submenu exists at all.',
    severity: 'HIGH',
  },
  {
    title: 'Search bar overlapping page content on scroll',
    desc: 'Sticky headers from one plugin plus a search bar from another: the search field ends up transparent, floating over your content, looking broken on every page.',
    severity: 'HIGH',
  },
  {
    title: 'Broken links after a permalink or page change',
    desc: 'WordPress sites accumulate dead internal links every time a page is renamed, a post is deleted, or permalinks change. Each one is a dead end for visitors and a negative signal to Google.',
    severity: 'CRITICAL',
  },
  {
    title: 'Logo invisible after a dark mode plugin',
    desc: 'Dark mode plugins recolour the page but not your logo image. A dark logo on a newly dark header simply vanishes.',
    severity: 'HIGH',
  },
  {
    title: 'No active state on the current menu item',
    desc: 'Many themes skip highlighting the current page in the navigation, leaving visitors with no sense of where they are on your site.',
    severity: 'MEDIUM',
  },
  {
    title: 'Giant empty space in the footer',
    desc: 'Leftover widget areas and spacing from page builders create huge blank blocks at the bottom of every page — the last impression every visitor leaves with.',
    severity: 'MEDIUM',
  },
]

const FAQS = [
  {
    q: 'Does QAlaunch work with any WordPress theme or page builder?',
    a: 'Yes. Elementor, Divi, Gutenberg, classic themes, WooCommerce — the audit runs on your live site in a real browser, so it sees exactly what visitors see regardless of what built it.',
  },
  {
    q: 'Is this a WordPress plugin I need to install?',
    a: 'No — nothing to install, no admin access needed. Paste your URL and the audit runs from the outside, like a real visitor. Your site stays untouched.',
  },
  {
    q: 'Will it find plugin conflicts?',
    a: 'It finds the visible symptoms of them: layout breaks, overlapping elements, broken functionality, JavaScript-driven features that stopped working. It won\'t tell you which plugin caused it, but it shows you exactly what\'s broken and where, with screenshots.',
  },
  {
    q: 'Does it check WooCommerce stores?',
    a: 'Yes — product pages, category pages, and cart are all public pages the audit can cover. The final payment step itself can\'t be tested since the scan can\'t complete a real purchase.',
  },
  {
    q: 'What does it cost?',
    a: 'The free scan shows your top issues with no signup. Full reports are one-time purchases from $9 (single page) to $59 (up to 10 pages). No subscription.',
  },
]

export default function ForWordPressPage() {
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
            FOR WORDPRESS SITES
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight tracking-tight mb-5">
            Every plugin update can break something.<br />
            <span className="text-[#22c55e]">Know what your visitors are seeing.</span>
          </h1>
          <p className="text-[#aab3c8] text-lg leading-relaxed mb-8 max-w-2xl">
            WordPress sites are living things — themes update, plugins conflict, pages get renamed,
            links die. QAlaunch opens your site in a real browser on desktop and mobile, runs 35+
            automated checks plus AI visual review, and hands you every issue in plain English.
          </p>
          <Link
            href="/#audit-input"
            className="inline-block bg-[#22c55e] text-[#06140d] font-bold px-6 py-3 text-sm hover:bg-[#16a34a] transition-colors whitespace-nowrap"
          >
            Audit My Website Free →
          </Link>
          <p className="text-[#5c6884] text-xs mt-3">Free · No plugin to install · Results in ~2 min</p>
        </div>
      </section>

      <section className="py-16 px-6 bg-[#f5f6f8]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-3">The issues we find most often on WordPress sites</h2>
          <p className="text-[#5b6472] mb-10">
            From auditing real WordPress sites across themes and page builders — problems that appear
            gradually as sites evolve, and that owners stop noticing because they see their site every day.
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
              { n: '1', t: 'Paste your site URL', d: 'No plugin, no login, no admin access. Just the public URL of any page.' },
              { n: '2', t: 'Real browser audit', d: 'Desktop and mobile screenshots, 35+ automated checks, AI-powered visual review of what visitors actually see.' },
              { n: '3', t: 'Plain-English report', d: 'Top issues free in ~2 minutes. Full multi-page report as PDF from $9, one-time.' },
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
          <p className="text-sm text-[#5b6472] mt-10">
            Running a Shopify store too? See our{' '}
            <Link href="/for-shopify" className="text-[#16a34a] font-semibold hover:underline">Shopify store audit guide</Link>.
            {' '}Built something with AI tools? Check the{' '}
            <Link href="/for-lovable" className="text-[#16a34a] font-semibold hover:underline">Lovable</Link>
            {' '}and{' '}
            <Link href="/for-bolt" className="text-[#16a34a] font-semibold hover:underline">Bolt.new</Link>
            {' '}pages.
          </p>
        </div>
      </section>

      <section className="py-12 px-6 bg-[#eef6f0] border-y border-[#d1e9d9]">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-xl font-bold mb-2">Run a free check on your WordPress site</h2>
          <p className="text-sm text-[#5b6472] mb-5">No plugin. No signup. Top issues in about 2 minutes.</p>
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
          <h2 className="text-2xl font-bold mb-3">See your site the way visitors do</h2>
          <p className="text-[#aab3c8] mb-6">Free scan, no signup. Full report from $9.</p>
          <Link href="/#audit-input" className="inline-block bg-[#22c55e] text-[#06140d] font-bold px-8 py-3 hover:bg-[#16a34a] transition-colors">
            Audit My WordPress Site Free →
          </Link>
        </div>
      </section>

    </main>
      <SiteFooter />
    </>
  )
}
