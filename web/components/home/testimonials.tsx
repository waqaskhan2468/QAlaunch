"use client"

import { Star } from "lucide-react"
import { motion } from "motion/react"

import { Reveal, fanOut, stagger } from "@/components/motion/primitives"
import { SectionHeader } from "@/components/site/section-header"

const testimonials = [
  {
    quote:
      "I thought my Lovable app was ready to launch. QAlaunch found a broken checkout button, an invisible CTA on mobile, and 3 JS errors — all in under a minute. Saved me from a disastrous launch.",
    name: "James M.",
    role: "SaaS Founder — Built with Lovable",
    initials: "JM",
    avatarTone: "bg-brand",
  },
  {
    quote:
      "The report was so clear my developer fixed everything the same day without a single question. The screenshot evidence for each issue made it impossible to misunderstand what needed fixing.",
    name: "Sarah R.",
    role: "eCommerce Owner — Shopify Store",
    initials: "SR",
    avatarTone: "bg-accent-bright",
  },
  {
    quote:
      "I've used SEMrush and GTmetrix but neither tested actual usability. QAlaunch told me my navigation disappeared on scroll and my contact form wasn't sending. Those are the things that kill conversions.",
    name: "Alex K.",
    role: "Freelance Developer — Bolt.new user",
    initials: "AK",
    avatarTone: "bg-[#7C3AED]",
  },
]

export function Testimonials() {
  return (
    <section className="bg-surface-soft px-5 py-20 md:px-12 md:py-24">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <SectionHeader
            eyebrow="What Customers Say"
            title="Builders trust QAlaunch"
            description="From Lovable apps to Shopify stores — QAlaunch finds the issues that were silently hurting real customers."
          />
        </Reveal>
        <motion.div
          className="mt-12 grid gap-5 md:grid-cols-3"
          variants={stagger(0.1, 0.12)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
        >
          {testimonials.map((t, i) => (
            <motion.figure
              key={t.name}
              custom={{ i, total: testimonials.length }}
              variants={fanOut}
              whileHover={{ y: -6 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              tabIndex={0}
              className="flex flex-col rounded-none border-2 border-slate-deep bg-white p-7 outline-none transition-colors hover:border-accent-bright focus-visible:border-accent-bright focus-visible:ring-4 focus-visible:ring-accent-bright/20"
            >
              <div
                className="mb-4 flex gap-0.5 text-[#F59E0B]"
                aria-label="5 star rating"
              >
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className="size-3.5"
                    fill="currentColor"
                    strokeWidth={0}
                  />
                ))}
              </div>
              <blockquote className="flex-1 text-sm italic leading-relaxed text-ink sm:text-base">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <div
                  className={`flex size-10 items-center justify-center rounded-full font-heading text-sm font-extrabold text-white ${t.avatarTone}`}
                >
                  {t.initials}
                </div>
                <div>
                  <div className="text-sm font-bold text-ink">{t.name}</div>
                  <div className="text-xs text-muted-ink">{t.role}</div>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
