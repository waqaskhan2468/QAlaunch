import type { Metadata } from "next"
import { Mail, Clock, Globe2 } from "lucide-react"

import { SiteNav } from "@/components/site/site-nav"
import { SiteFooter } from "@/components/site/site-footer"
import { ContactForm } from "@/components/contact/contact-form"
import { ContactHero } from "@/components/contact/contact-hero"

export const metadata: Metadata = {
  title: "Contact — QAlaunch | Enterprise & Custom Website Audits",
  description:
    "Get in touch with QAlaunch for custom enterprise website audits, large multi-page projects, or questions about your report. We respond within 24 hours.",
}

const contactMethods = [
  { icon: Mail, label: "Email", value: "hello@getqalaunch.com" },
  { icon: Clock, label: "Response Time", value: "Within 24 hours" },
  {
    icon: Globe2,
    label: "Serving",
    value: "USA, UK, Canada, Australia, Europe & worldwide",
  },
]

export default function ContactPage() {
  return (
    <>
      <SiteNav />
      <main className="pt-16">
        <ContactHero />

        {/* Contact body */}
        <section className="px-5 py-20 md:px-12 md:py-24">
          <div className="mx-auto grid max-w-6xl items-start gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 className="mb-3 font-heading text-3xl font-black tracking-tight text-ink">
                We respond within 24 hours
              </h2>
              <p className="mb-7 text-base leading-relaxed text-body">
                Whether you need a custom enterprise audit, have a question
                about your report, or want to discuss your website&apos;s
                quality challenges — we are here to help.
              </p>

              <div className="flex flex-col gap-3.5">
                {contactMethods.map(({ icon: Icon, label, value }) => (
                  <div
                    key={label}
                    className="flex items-start gap-3.5 rounded-xl border border-border-soft bg-white p-4 transition-colors hover:border-brand/40"
                  >
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-pale text-brand">
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-widest text-muted-ink">
                        {label}
                      </div>
                      <div className="mt-0.5 text-sm font-bold text-ink sm:text-[15px]">
                        {value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-7 rounded-2xl border border-border-soft bg-gradient-to-br from-brand-pale to-white p-7">
                <div className="font-heading text-lg font-extrabold text-ink">
                  11+ pages? We&apos;ll quote you.
                </div>
                <p className="mt-2 text-sm leading-relaxed text-body">
                  Fill in the form and we&apos;ll come back with a tailored
                  scope and price within 24 hours.
                </p>
                <div className="mt-3 text-xs font-bold text-brand sm:text-sm">
                  Custom pricing · Dedicated QA engineer · Video walkthrough
                </div>
              </div>
            </div>

            <ContactForm />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
