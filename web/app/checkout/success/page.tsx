import type { Metadata } from "next"
import { Suspense } from "react"

import { SiteNav } from "@/components/site/site-nav"
import { SiteFooter } from "@/components/site/site-footer"
import { CheckoutSuccessExperience } from "@/components/checkout/checkout-success"

export const metadata: Metadata = {
  title: "Order confirmed — QAlaunch",
  description:
    "Your website audit is queued. You will receive your PDF report by email shortly.",
  robots: { index: false, follow: true },
}

export default function CheckoutSuccessPage() {
  return (
    <>
      <SiteNav />
      <main className="pt-16">
        <section className="bg-slate-deep px-5 py-12 text-center md:px-12 md:py-16">
          <div className="mx-auto max-w-2xl">
            <h1 className="font-heading mx-auto text-[clamp(1.75rem,4vw,2.5rem)] font-black leading-[1.08] tracking-[-0.025em] text-balance text-white">
              Order confirmed
            </h1>
            <p className="mx-auto mt-2 text-[16px] text-white/65">
              Your audit is being prepared. Full details below.
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
            <CheckoutSuccessExperience />
          </Suspense>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
