"use client"

import { motion } from "motion/react"

import { fadeUp, stagger } from "@/components/motion/primitives"

export function ContactHero() {
  return (
    <section className="relative overflow-hidden bg-slate-deep px-5 py-20 text-center sm:px-8 md:px-12 md:py-24 lg:py-28">
      {/* Decorative dot grid + glowing orbs (match home hero) */}
      <div className="qa-hero-grid pointer-events-none absolute inset-0" />
      <div className="qa-orb-float pointer-events-none absolute -left-40 -top-40 size-[520px] rounded-full bg-[radial-gradient(circle,rgba(24,71,168,0.45)_0%,transparent_65%)]" />
      <div className="qa-orb-float-alt pointer-events-none absolute -bottom-48 -right-32 size-[460px] rounded-full bg-[radial-gradient(circle,rgba(34,197,94,0.18)_0%,transparent_60%)]" />

      <motion.div
        className="relative z-10 mx-auto flex max-w-3xl flex-col items-center"
        variants={stagger(0.1, 0.1)}
        initial="hidden"
        animate="visible"
      >
        <motion.div
          variants={fadeUp}
          className="inline-flex items-center gap-2 rounded-full border border-accent-bright/25 bg-accent-bright/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#4ade80]"
        >
          <span className="relative flex size-[7px]">
            <motion.span
              className="absolute inset-0 rounded-full bg-[#4ade80]"
              animate={{ scale: [1, 2.4, 1], opacity: [0.55, 0, 0.55] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
            />
            <span className="relative inline-flex size-full rounded-full bg-[#4ade80]" />
          </span>
          Replies within 24 hours
        </motion.div>

        <motion.h1
          variants={fadeUp}
          className="mt-7 font-heading text-[clamp(2.25rem,5.2vw,3.5rem)] font-black leading-[1.05] tracking-tight text-balance text-white"
        >
          Let&apos;s scope your{" "}
          <span className="relative inline-block text-accent-bright">
            custom audit
            <motion.span
              aria-hidden="true"
              className="absolute inset-x-0 -bottom-1 h-[3px] origin-left rounded-full bg-accent-bright/80"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{
                delay: 0.8,
                duration: 0.7,
                ease: [0.22, 1, 0.36, 1],
              }}
            />
          </span>
        </motion.h1>

        <motion.p
          variants={fadeUp}
          className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/65 sm:text-lg"
        >
          Large website, enterprise engagement, or a question about your
          report? Tell us a bit about your project and we&apos;ll come back
          with a tailored scope and price.
        </motion.p>

        <motion.div
          variants={fadeUp}
          className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-white/55"
        >
          <span className="inline-flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-accent-bright" />
            Custom enterprise pricing
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-accent-bright" />
            Dedicated QA engineer
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-accent-bright" />
            Video walkthrough
          </span>
        </motion.div>
      </motion.div>
    </section>
  )
}
