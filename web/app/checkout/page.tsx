import type { Metadata } from "next"
import { Suspense } from "react"

import { SiteNav } from "@/components/site/site-nav"
import { SiteFooter } from "@/components/site/site-footer"
import { CheckoutExperience } from "@/components/checkout/checkout-experience"

export const metadata: Metadata = {
  title: "Checkout — QAlaunch",
  description:
    "Complete your website audit purchase securely with Paddle. One-time pricing; PDF report emailed when ready.",
  robots: { index: false, follow: true },
}

export default function CheckoutPage() {
  return (
    <>
      <SiteNav />
      <main className="pt-16">
        <section className="bg-slate-deep px-5 py-14 text-center md:px-12 md:py-20">
          <div className="mx-auto max-w-2xl">
            <h1 className="font-heading mx-auto text-[clamp(1.85rem,4vw,2.75rem)] font-black leading-[1.08] tracking-[-0.025em] text-balance text-white">
              Checkout
            </h1>
            <p className="mx-auto pt-2 text-[17px] text-white/60">
              Confirm your plan and site URL, then pay securely with Paddle.
            </p>
          </div>
        </section>

        <section className="bg-surface-soft">
          <Suspense
            fallback={
              <div className="flex min-h-[320px] items-center justify-center">
                <div className="qa-spin size-12 rounded-full border-4 border-brand-pale border-t-brand" />
              </div>
            }
          >
            <CheckoutExperience />
          </Suspense>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
