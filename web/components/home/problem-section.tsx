"use client"

import { Frown, Smartphone, AlertTriangle, Clock } from "lucide-react"
import { motion } from "motion/react"

import { SectionHeader } from "@/components/site/section-header"
import { fadeUp, stagger } from "@/components/motion/primitives"

const problems = [
  {
    icon: Frown,
    title: "Users can't figure out how to use your site",
    description:
      "Confusing navigation, unclear CTAs, and poor information hierarchy make visitors give up — even if your product is exactly what they need.",
    stat: "88% of users never return after a bad experience",
  },
  {
    icon: Smartphone,
    title: "Your site looks broken on their phone",
    description:
      "Over 60% of web traffic is mobile. Buttons that don't tap, text that overflows, and layouts that collapse are invisible to you on desktop but fatal on mobile.",
    stat: "61% won't return to a mobile-unfriendly site",
  },
  {
    icon: AlertTriangle,
    title: "Broken forms and non-working buttons",
    description:
      "Forms that submit nowhere. CTAs that go to 404 pages. These failures happen after every update and most businesses discover them weeks later — from angry customers.",
    stat: "1 in 4 AI-built sites has a critical broken element",
  },
  {
    icon: Clock,
    title: "It loads too slowly to hold attention",
    description:
      "Users decide in 3 seconds. A slow page doesn't just frustrate — it signals an untrustworthy, low-quality product before your content even loads.",
    stat: "53% of users leave if a page takes over 3 seconds",
  },
]

/**
 * Four-card problem framing section. Cards stagger in on scroll and
 * lift/tilt on hover for a tactile, modern feel.
 */
export function ProblemSection() {
  return (
    <section className="bg-surface-soft px-5 py-20 md:px-12 md:py-24">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="The Real Problem"
          title={
            <>
              Your website is silently
              <br className="hidden md:block" /> losing customers every day
            </>
          }
          description="Broken buttons, confusing layouts, and slow mobile pages don't announce themselves. Your customers just leave — and never tell you why."
        />

        <motion.div
          className="mt-12 grid gap-5 md:grid-cols-2"
          variants={stagger(0.1, 0.12)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          {problems.map(({ icon: Icon, title, description, stat }) => (
            <motion.article
              key={title}
              variants={fadeUp}
              whileHover={{ y: -6 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              tabIndex={0}
              className="group relative overflow-hidden rounded-2xl border border-border-soft bg-white p-7 outline-none hover:border-brand hover:shadow-card-hover focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/15"
            >
              <span className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-danger to-[#f97316]" />
              <motion.div
                whileHover={{ rotate: -8, scale: 1.12 }}
                transition={{ type: "spring", stiffness: 320, damping: 15 }}
                className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-danger-pale text-danger"
              >
                <Icon className="size-5" />
              </motion.div>
              <h3 className="font-heading text-lg font-extrabold leading-snug text-ink">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-body">
                {description}
              </p>
              <span className="mt-4 inline-block rounded-full bg-danger-pale px-3 py-1 text-xs font-bold text-danger">
                {stat}
              </span>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
