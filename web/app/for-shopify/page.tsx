// app/for-shopify/page.tsx

import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteNav } from '@/components/site/site-nav'
import { SiteFooter } from '@/components/site/site-footer'

export const metadata: Metadata = {
  title: 'Check Your Shopify Store for Bugs Before Launch | QAlaunch',
  description: 'Free automated audit for Shopify stores. Find broken links, mobile checkout issues, invisible buttons, and usability problems costing you sales — in 2 minutes, no signup.',
  openGraph: {
    title: 'Check Your Shopify Store for Bugs Before Launch',
    description: 'Free automated audit for Shopify stores. Find the frontend bugs quietly costing you sales — in 2 minutes.',
    url: 'https://getqalaunch.com/for-shopify',
  },
}

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'QAlaunch',
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'Website Audit & QA Testing Tool',
  operatingSystem: 'Web',
  url: 'https://getqalaunch.com/for-shopify',
  description:
    'Free automated audit for Shopify stores. Find broken links, mobile checkout issues, invisible buttons, and usability problems costing you sales — in 2 minutes, no signup.',
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
    title: 'Slider arrows customers can\'t see',
    desc: 'Product carousels in many Shopify themes ship with low-contrast navigation arrows. Customers don\'t realise there are more products to scroll — they only ever see the first slide.',
    severity: 'HIGH',
  },
  {
    title: 'Price text unreadable over banner images',
    desc: 'White price or promo text placed over light product photography becomes invisible. It looks fine in the theme editor with your test image, then breaks the moment a different image loads.',
    severity: 'HIGH',
  },
  {
    title: '"Explore all" buttons that loop back to the homepage',
    desc: 'A frequent theme-customisation miss: collection or Instagram section CTAs pointing to / instead of their intended destination. Customers click, nothing changes, they leave.',
    severity: 'CRITICAL',
  },
  {
    title: 'Inconsistent buttons across collection banners',
    desc: 'One banner\'s Shop Collection button sits at the bottom, another\'s sits at the top. Each works, but the layout reads as broken — and broken-looking stores don\'t get credit card numbers.',
    severity: 'MEDIUM',
  },
  {
    title: 'Sticky nav with no background on scroll',
    desc: 'Your menu and cart icon float transparently over product images as customers scroll — hard to see, hard to tap, and your cart icon is the single most important element on the page.',
    severity: 'HIGH',
  },
  {
    title: 'Mobile menu icons too small to tap',
    desc: 'Most Shopify traffic is mobile. Hamburger menus and cart icons under ~44px are genuinely difficult to hit with a thumb, adding friction exactly where you can least afford it.',
    severity: 'HIGH',
  },
]

const FAQS = [
  {
    q: 'Does QAlaunch work on Shopify stores?',
    a: 'Yes — any publicly accessible Shopify store, on any theme, with any level of customisation. Paste your store URL and the audit runs in a real browser, exactly as a customer would see it.',
  },
  {
    q: 'Is this the same as a Shopify SEO audit?',
    a: 'It includes SEO fundamentals (meta titles, descriptions, heading structure, alt text) but goes further: usability, mobile responsiveness, broken links and buttons, UI issues, and functionality — the things that stop a visitor becoming a customer after they\'ve already found you.',
  },
  {
    q: 'Will it check my checkout?',
    a: 'QAlaunch audits every public page you choose — homepage, collections, product pages, cart. It cannot complete a real purchase, so the final payment step itself isn\'t tested. Everything a customer sees before that point is.',
  },
  {
    q: 'My store is password-protected pre-launch. Can I still scan it?',
    a: 'The scan needs a publicly reachable page, so remove the storefront password first (or scan right after launch). Password-protected preview stores can\'t be reached by the audit browser.',
  },
  {
    q: 'How much does it cost?',
    a: 'The free scan shows your top issues, no signup needed. Full reports are one-time purchases: $9 for one page, $24 for 2-5 pages, $59 for 6-10 pages — enough to cover homepage, key collections, a product page, and cart.',
  },
]

export default function ForShopifyPage() {
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
            FOR SHOPIFY STORES
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight tracking-tight mb-5">
            Your Shopify store has bugs<br />
            <span className="text-[#22c55e]">quietly costing you sales.</span>
          </h1>
          <p className="text-[#aab3c8] text-lg leading-relaxed mb-8 max-w-2xl">
            Theme customisations break things the theme editor never shows you. Invisible slider arrows,
            unreadable price text, buttons that loop back to the homepage, a cart icon customers can&apos;t
            find on mobile. QAlaunch opens your store in a real browser — desktop and mobile — and shows
            you every issue in plain English.
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
          <h2 className="text-2xl font-bold mb-3">The bugs we find most often in Shopify stores</h2>
          <p className="text-[#5b6472] mb-10">
            These come from auditing real stores — issues that never appear in the theme editor preview,
            only on a real device in a real customer&apos;s hands.
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
              { n: '1', t: 'Paste your store URL', d: 'Homepage, a collection, a product page — any public page of your store.' },
              { n: '2', t: 'Real browser audit', d: 'A real cloud browser loads your store on desktop and mobile widths and runs 35+ automated checks plus AI visual review.' },
              { n: '3', t: 'Plain-English report', d: 'Top issues free. Full report covering homepage, collections, product pages and cart from $9, one-time.' },
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
            Building with an AI site builder instead? See our guides for{' '}
            <Link href="/for-lovable" className="text-[#16a34a] font-semibold hover:underline">Lovable sites</Link>
            {' '}and{' '}
            <Link href="/for-bolt" className="text-[#16a34a] font-semibold hover:underline">Bolt.new sites</Link>.
          </p>
        </div>
      </section>

      <section className="py-12 px-6 bg-[#eef6f0] border-y border-[#d1e9d9]">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-xl font-bold mb-2">Run a free check on your store</h2>
          <p className="text-sm text-[#5b6472] mb-5">No account needed. Top issues in about 2 minutes.</p>
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
          <h2 className="text-2xl font-bold mb-3">Find what&apos;s costing you sales</h2>
          <p className="text-[#aab3c8] mb-6">Free scan, no signup. Full report from $9.</p>
          <Link href="/#audit-input" className="inline-block bg-[#22c55e] text-[#06140d] font-bold px-8 py-3 hover:bg-[#16a34a] transition-colors">
            Audit My Shopify Store Free →
          </Link>
        </div>
      </section>

    </main>
      <SiteFooter />
    </>
  )
}
