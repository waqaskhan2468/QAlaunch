"use client"

import { ChevronDown } from "lucide-react"
import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"

import { cn } from "@/lib/utils"
import { fadeUpSoft, stagger } from "@/components/motion/primitives"

export type FAQItem = {
  q: string
  a: string
}

const homeFaqs: FAQItem[] = [
  {
    q: "What is a website audit and why do I need one?",
    a: "A website audit is a comprehensive quality check of your website that identifies problems affecting your users — broken links, usability issues, slow load times, mobile layout failures, and UI bugs. You need one because most website problems are invisible to the owner but very visible to customers. A professional audit finds issues before your users do — protecting your reputation and revenue.",
  },
  {
    q: "How is QAlaunch different from other free website checkers?",
    a: "Most website checkers test for SEO and page speed — they report on what Google sees. QAlaunch tests for what real users experience: usability problems, broken functionality, UI bugs, and mobile responsiveness failures. These are the issues that actually cost you customers, and no generic SEO tool finds them. QAlaunch also delivers developer-ready fix instructions with screenshot evidence, so issues get fixed — not just listed.",
  },
  {
    q: "How long does the free website audit take?",
    a: "The free audit preview takes under 120 seconds and shows your 3 most critical issues at no cost. A full paid audit report is generated within 3–5 minutes of payment. You receive a PDF download link by email as soon as it's ready — there's no waiting around.",
  },
  {
    q: "What does the full paid report include?",
    a: "Your full report includes: an overall health score (0–100) with category breakdowns, every issue found categorised by type and severity (Critical/High/Medium/Low), a screenshot showing exactly where each issue appears on your live site, a plain-English explanation of why it matters, and step-by-step developer fix instructions. The report is designed so your developer can action every issue without a single follow-up question.",
  },
  {
    q: "Do you test websites built with Lovable, Bolt, or Replit?",
    a: "Yes — QAlaunch was specifically designed with AI-built websites in mind. Lovable, Bolt.new, Replit, v0, and Cursor sites all ship fast but tend to produce repeating patterns of usability issues, mobile responsiveness failures, and broken interactive elements. Our checks are tuned to find exactly these patterns, which generic website checkers miss entirely.",
  },
  {
    q: "What if my website requires a login to access?",
    a: "QAlaunch automatically detects login barriers. If your site requires authentication, we run all 35 checks on your publicly accessible pages and clearly document in the report which areas were excluded due to the login requirement. You still receive a comprehensive audit of everything visible to new visitors — which is often where the most important user experience issues live anyway.",
  },
]

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
          className="mb-10 text-center font-heading text-[clamp(1.5rem,3vw,2.25rem)] font-black leading-tight tracking-tight text-ink"
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
                  "overflow-hidden rounded-xl border bg-white transition-colors",
                  open
                    ? "border-brand shadow-card"
                    : "border-border-soft hover:border-brand/40",
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(open ? null : i)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-bold text-ink transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/40"
                >
                  <span className="text-base leading-snug">{item.q}</span>
                  <motion.span
                    animate={{ rotate: open ? 180 : 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="inline-flex"
                  >
                    <ChevronDown
                      className={cn(
                        "size-5 shrink-0 transition-colors",
                        open ? "text-brand" : "text-muted-ink",
                      )}
                    />
                  </motion.span>
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
