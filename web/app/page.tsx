import { SiteNav } from "@/components/site/site-nav"
import { SiteFooter } from "@/components/site/site-footer"
import { Hero } from "@/components/home/hero"
import { Ticker } from "@/components/home/ticker"
import { ProblemSection } from "@/components/home/problem-section"
import { TestSuite } from "@/components/home/test-suite"
import { HowItWorks } from "@/components/home/how-it-works"
import { Testimonials } from "@/components/home/testimonials"
import { PricingPreview } from "@/components/home/pricing-preview"
import { Comparison } from "@/components/home/comparison"
import { FAQ } from "@/components/home/faq"
import { CtaBand } from "@/components/home/cta-band"

/**
 * Schema.org SoftwareApplication structured data for the homepage. Helps
 * Google understand the product, its category, and pricing for rich
 * results. No aggregateRating is included — we have no verified reviews
 * and must not fabricate one. Pricing mirrors the canonical plans
 * (Basic $9 → Premium $59) in components/pricing/pricing-plans.ts.
 */
const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "QAlaunch",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Website Audit & QA Testing Tool",
  operatingSystem: "Web",
  url: "https://getqalaunch.com",
  description:
    "AI website audit tool by a senior QA engineer. Find UI bugs, broken buttons & mobile issues on any site in 120 seconds. Reports from $9.",
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "USD",
    lowPrice: "9",
    highPrice: "59",
    offerCount: "3",
  },
  creator: {
    "@type": "Organization",
    name: "QAlaunch",
    url: "https://getqalaunch.com",
  },
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <SiteNav />
      <main className="pt-16">
        <Hero />
        <Ticker />
        <ProblemSection />
        <TestSuite />
        <HowItWorks />
        <Testimonials />
        <PricingPreview />
        <Comparison />
        <FAQ />
        <CtaBand />
      </main>
      <SiteFooter />
    </>
  )
}
