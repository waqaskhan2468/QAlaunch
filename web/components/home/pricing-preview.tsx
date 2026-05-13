"use client"

import { PricingGrid } from "@/components/pricing/pricing-grid"
import { Reveal } from "@/components/motion/primitives"
import { SectionHeader } from "@/components/site/section-header"

/**
 * Home-page pricing block. Same cards as the standalone Pricing page.
 */
export function PricingPreview() {
  return (
    <section className="px-5 py-20 md:px-12 md:py-24">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <SectionHeader
            eyebrow="Pricing"
            title="Simple, one-time pricing"
            description="No monthly subscriptions. No hidden fees. Pay only for the pages you want audited. Full PDF report delivered instantly."
            align="center"
          />
        </Reveal>
        <div className="mt-14">
          <PricingGrid />
        </div>
      </div>
    </section>
  )
}
