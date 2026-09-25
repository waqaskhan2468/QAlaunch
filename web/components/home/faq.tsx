"use client"

import { Minus, Plus } from "lucide-react"
import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"

import { cn } from "@/lib/utils"
import { fadeUpSoft, stagger } from "@/components/motion/primitives"
import { homeFaqs, type FAQItem } from "@/lib/content/home-faqs"

export { homeFaqs }
export type { FAQItem }


type FAQProps = {
  items?: FAQItem[]
  title?: string
  className?: string
}

/**
 * Accessible accordion for FAQs. Items fade up in a stagger on first view.
 * Opening/closing is a motion height + opacity spring, and the chevron
 * rotates smoothly. Single-open behavior — clicking another question
 * collapses the first.
 */
export function FAQ({
  items = homeFaqs,
  title = "Frequently asked questions",
  className,
}: FAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section className={cn("px-5 py-20 md:px-12 md:py-24", className)}>
      <div className="mx-auto max-w-3xl">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10 text-center font-heading text-[clamp(1.5rem,3vw,2.25rem)] font-black leading-tight tracking-[-0.02em] text-ink"
        >
          {title}
        </motion.h2>
        <motion.div
          className="flex flex-col gap-3"
          variants={stagger(0.05, 0.06)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          {items.map((item, i) => {
            const open = openIndex === i
            return (
              <motion.div
                key={item.q}
                variants={fadeUpSoft}
                className={cn(
                  "overflow-hidden rounded-none border-2 bg-white transition-colors",
                  open
                    ? "border-accent-bright"
                    : "border-slate-deep hover:border-accent-bright",
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(open ? null : i)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-bold text-ink transition-colors hover:text-accent-emerald focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-bright/40"
                >
                  <span className="text-base leading-snug">{item.q}</span>
                  <span className="inline-flex shrink-0" aria-hidden="true">
                    {open ? (
                      <Minus className="size-5 text-accent-bright" strokeWidth={3} />
                    ) : (
                      <Plus className="size-5 text-ink" strokeWidth={3} />
                    )}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-5 text-sm leading-relaxed text-body">
                        {item.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
