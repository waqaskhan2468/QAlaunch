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
 * Home page — composes all marketing sections in the order that
 * supports the sales narrative: hook → problem → solution → proof →
 * pricing → differentiation → objections → conversion.
 */
export default function HomePage() {
  return (
    <>
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
