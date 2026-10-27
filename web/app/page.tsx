import type { Metadata } from "next"

import { SiteNav } from "@/components/site/site-nav"
import { SiteFooter } from "@/components/site/site-footer"
import { Hero } from "@/components/home/hero"
import { Ticker } from "@/components/home/ticker"
import { ProblemSection } from "@/components/home/problem-section"
import { TestSuite } from "@/components/home/test-suite"
import { HowItWorks } from "@/components/home/how-it-works"
import { PricingPreview } from "@/components/home/pricing-preview"
import { Comparison } from "@/components/home/comparison"
import { BuiltWith } from "@/components/home/built-with"
import { FAQ } from "@/components/home/faq"
import { homeFaqs } from "@/lib/content/home-faqs"
import { faqPageSchema, jsonLd, ORGANIZATION_ID, WEBSITE_ID } from "@/lib/seo/structured-data"
import { CtaBand } from "@/components/home/cta-band"
import { PACKAGE_PRICE_USD, formatPackagePrice } from "@/components/pricing/pricing-plans"

// The homepage previously had no metadata of its own and relied entirely on the
// root layout. That was fine until the layout's site-wide `canonical: "/"` was
// removed — which it had to be, because every other page was inheriting it and
// declaring itself a duplicate of this one. Title and description still come
// from the layout defaults; only the canonical is stated here.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
}

/**
 * Schema.org SoftwareApplication structured data for the homepage. Helps
 * Google understand the product, its category, and pricing for rich
 * results. No aggregateRating is included — we have no verified reviews
 * and must not fabricate one. Pricing mirrors the canonical plans
 * (Basic → Premium) from components/pricing/pricing-plans.ts.
 */
const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": "https://getqalaunch.com/#software",
  name: "QAlaunch",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Website Audit & QA Testing Tool",
  operatingSystem: "Web",
  url: "https://getqalaunch.com",
  description:
    `AI website audit tool by a senior QA engineer. Find UI bugs, broken buttons & mobile issues on any site. Free scan in about 2 minutes; full reports from ${formatPackagePrice('basic')}.`,
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "USD",
    lowPrice: String(PACKAGE_PRICE_USD.basic),
    highPrice: String(PACKAGE_PRICE_USD.premium),
    offerCount: "3",
  },
  featureList: [
    "Real-browser testing in Chromium",
    "Desktop and phone (390px) viewports",
    "Broken link detection",
    "Button and form interaction checks",
    "Console error capture",
    "axe-core accessibility checks",
    "Google PageSpeed scores",
    "Screenshot evidence",
    "Fix instructions for every issue",
  ],
  creator: { "@id": ORGANIZATION_ID },
  isPartOf: { "@id": WEBSITE_ID },
}

/**
 * Home page — composes all marketing sections in the order that
 * supports the sales narrative: hook → problem → solution → proof →
 * pricing → differentiation → objections → conversion.
 */
export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }}
      />
      {/* Built from homeFaqs — the same array <FAQ /> renders below. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(faqPageSchema(homeFaqs)) }}
      />
      <SiteNav />
      <main className="pt-16">
        <Hero />
        <Ticker />
        <ProblemSection />
        <TestSuite />
        <HowItWorks />
        {/* <Testimonials /> is out until there are real, attributable quotes.
            The three it showed were placeholders, and they described a PDF
            with screenshot evidence that did not exist at the time. */}
        <PricingPreview />
        <Comparison />
        <BuiltWith />
        <FAQ />
        <CtaBand />
      </main>
      <SiteFooter />
    </>
  )
}
