"use client"

import { motion } from "motion/react"

import { fadeUp, stagger } from "@/components/motion/primitives"

const steps = [
  {
    n: 1,
    title: "Enter Your Website URL",
    description:
      'Paste your URL above and click "Audit My Website Free". No account. No credit card. No setup. Just your URL and one click.',
  },
  {
    n: 2,
    title: "Get Your Free Preview",
    description:
      "In 120 seconds, we surface your 3 most critical usability, UI, and functionality issues completely free — with severity, impact, and what's at stake.",
  },
  {
    n: 3,
    title: "Unlock Your Full Report",
    description:
      "Choose a plan based on how many pages to audit. Get a full PDF report with 35+ checks, screenshot evidence, and step-by-step developer fix instructions. From just $9.",
  },
]

/**
 * Dark "3-step" section. The connector line draws in on scroll, then each
 * numbered step pops in with a spring and tilts on hover.
 */
export function HowItWorks() {
  return (
    <section className="bg-slate-deep px-5 py-20 md:px-12 md:py-24">
      <div className="mx-auto max-w-6xl">
        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-14 text-center font-heading text-[clamp(1.75rem,3.6vw,2.5rem)] font-black leading-tight tracking-tight text-white text-balance"
        >
          From URL to expert audit report in 3 steps
        </motion.h2>

        <motion.div
          className="relative grid gap-12 md:grid-cols-3 md:gap-0"
          variants={stagger(0.2, 0.2)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          {/* Connector line — draws in on scroll */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute left-[16.7%] right-[16.7%] top-[33px] hidden h-px origin-left bg-gradient-to-r from-accent-bright/50 via-accent-bright/30 to-brand-mid/50 md:block"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ delay: 0.3, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />

          {steps.map((step) => (
            <motion.div
              key={step.n}
              variants={fadeUp}
              className="group relative px-4 text-center"
            >
              <motion.div
                whileHover={{ y: -6, scale: 1.06, rotate: -3 }}
                transition={{ type: "spring", stiffness: 300, damping: 18 }}
                className="relative z-10 mx-auto mb-5 flex size-16 items-center justify-center rounded-full border-[2.5px] border-accent-bright/45 bg-gradient-to-br from-brand to-brand-mid font-heading text-2xl font-black text-white shadow-glow-brand"
              >
                {step.n}
              </motion.div>
              <h3 className="mb-2 font-heading text-lg font-extrabold text-white">
                {step.title}
              </h3>
              <p className="mx-auto max-w-xs text-sm leading-relaxed text-white/55">
                {step.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
