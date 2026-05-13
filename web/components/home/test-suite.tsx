"use client"

import {
  Brain,
  Wrench,
  Paintbrush,
  Smartphone,
  Gauge,
  Search,
} from "lucide-react"
import { motion } from "motion/react"

import { Reveal, popIn, stagger } from "@/components/motion/primitives"
import { SectionHeader } from "@/components/site/section-header"
import { cn } from "@/lib/utils"

type Priority = "top" | "core"

const tests: {
  icon: React.ComponentType<{ className?: string }>
  iconTone: string
  title: string
  description: string
  tags: string[]
  priority: Priority
}[] = [
  {
    icon: Brain,
    iconTone: "bg-[#FFF5F5] text-danger",
    title: "Usability Testing",
    description:
      "Can users accomplish what they came to do? We analyse navigation clarity, CTA visibility, user flow, task completion, and whether your layout guides users — or confuses them away.",
    tags: ["Navigation", "CTA Clarity", "User Flow", "Task Completion"],
    priority: "top",
  },
  {
    icon: Wrench,
    iconTone: "bg-[#F8F4FF] text-[#7C3AED]",
    title: "Functionality",
    description:
      "Do all interactive elements actually work? Forms, buttons, links, carousels, modals — we test everything users touch to ensure nothing is silently broken on your live site right now.",
    tags: ["Forms", "Buttons", "JS Errors", "Broken Links"],
    priority: "top",
  },
  {
    icon: Paintbrush,
    iconTone: "bg-[#FFF8F0] text-[#C2410C]",
    title: "UI / Visual Bugs",
    description:
      "Is any text invisible? Are elements misaligned? We visually inspect every section using AI screenshot analysis to catch UI defects — contrast issues, broken images, spacing problems.",
    tags: ["Contrast", "Alignment", "Broken Images", "Consistency"],
    priority: "top",
  },
  {
    icon: Smartphone,
    iconTone: "bg-[#F0FDFA] text-[#0D9488]",
    title: "Mobile Responsiveness",
    description:
      "We test your layout at iPhone SE (375px), iPhone 14 (390px), and iPad (768px) sizes — checking every section, navigation, touch targets, and font readability across real device widths.",
    tags: ["iPhone SE", "Touch Targets", "Overflow", "Font Scaling"],
    priority: "top",
  },
  {
    icon: Gauge,
    iconTone: "bg-accent-pale text-accent-emerald",
    title: "Performance & Speed",
    description:
      "We measure Core Web Vitals on both mobile and desktop — LCP, FCP, CLS, TTI — and give you specific, actionable fixes for every metric that falls below Google's recommended thresholds.",
    tags: ["LCP", "FCP", "CLS", "Mobile + Desktop"],
    priority: "core",
  },
  {
    icon: Search,
    iconTone: "bg-brand-pale text-brand",
    title: "SEO Fundamentals",
    description:
      "We check the on-page SEO basics every website must have — meta titles, descriptions, H1 structure, image alt text, and canonical tags. No keyword research. Just the fundamentals that affect your Google visibility.",
    tags: ["Meta Tags", "H1 Structure", "Alt Text", "Canonical"],
    priority: "core",
  },
]

export function TestSuite() {
  return (
    <section className="px-5 py-20 md:px-12 md:py-24">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <SectionHeader
            eyebrow="Complete Test Suite"
            title={
              <>
                Every check your users
                <br className="hidden md:block" /> actually care about
              </>
            }
            description="We lead with what matters to real humans — not just search engines. Usability and functionality first, SEO last."
          />
        </Reveal>
        <motion.div
          className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          variants={stagger(0.08, 0.1)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          {tests.map(
            ({ icon: Icon, iconTone, title, description, tags, priority }) => (
              <motion.article
                key={title}
                variants={popIn}
                whileHover={{ y: -6 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                tabIndex={0}
                className={cn(
                  "group rounded-2xl border border-border-soft bg-white p-6 outline-none",
                  "hover:border-brand hover:shadow-card-hover",
                  "focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/15",
                )}
              >
                <div className="mb-3 flex items-center gap-3">
                  <motion.div
                    whileHover={{ rotate: -6, scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 320, damping: 15 }}
                    className={cn(
                      "flex size-11 items-center justify-center rounded-xl",
                      iconTone,
                    )}
                  >
                    <Icon className="size-5" />
                  </motion.div>
                  <h3 className="font-heading text-base font-extrabold text-ink">
                    {title}
                  </h3>
                  <span
                    className={cn(
                      "ml-auto rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                      priority === "top"
                        ? "bg-[#FFF3E8] text-[#C2410C]"
                        : "bg-brand-pale text-brand",
                    )}
                  >
                    {priority === "top" ? "Top Priority" : "Core Check"}
                  </span>
                </div>
                <p className="mb-4 text-sm leading-relaxed text-body">
                  {description}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-brand-pale px-2.5 py-1 text-[11px] font-semibold text-brand transition-colors group-hover:bg-brand group-hover:text-white"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </motion.article>
            ),
          )}
        </motion.div>
      </div>
    </section>
  )
}
