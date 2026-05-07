"use client"

import { Check, X, Rocket } from "lucide-react"
import { motion } from "motion/react"

import { SectionHeader } from "@/components/site/section-header"
import { cn } from "@/lib/utils"
import { fadeUpSoft, stagger } from "@/components/motion/primitives"

type Cell =
  | { kind: "yes" }
  | { kind: "no" }
  | { kind: "partial"; label: string }

const rows: { feature: string; qa: Cell; others: Cell }[] = [
  {
    feature: "Usability & UX testing (not just SEO)",
    qa: { kind: "yes" },
    others: { kind: "no" },
  },
  {
    feature: "Broken functionality & button detection",
    qa: { kind: "yes" },
    others: { kind: "no" },
  },
  {
    feature: "AI visual UI/UX screenshot analysis",
    qa: { kind: "yes" },
    others: { kind: "no" },
  },
  {
    feature: "Built for AI-generated sites (Lovable, Bolt, Replit)",
    qa: { kind: "yes" },
    others: { kind: "no" },
  },
  {
    feature: "eCommerce & Shopify specific checks",
    qa: { kind: "yes" },
    others: { kind: "partial", label: "Limited" },
  },
  {
    feature: "Developer-ready fix instructions per issue",
    qa: { kind: "yes" },
    others: { kind: "partial", label: "Partial" },
  },
  {
    feature: "One-time payment — no monthly subscription",
    qa: { kind: "yes" },
    others: { kind: "no" },
  },
  {
    feature: "Multi-page audit (up to 10+ pages)",
    qa: { kind: "yes" },
    others: { kind: "partial", label: "Limited" },
  },
  {
    feature: "Screenshot evidence attached to each issue",
    qa: { kind: "yes" },
    others: { kind: "no" },
  },
  {
    feature: "Pricing starting at $9 per report",
    qa: { kind: "yes" },
    others: { kind: "no" },
  },
]

function renderCell(cell: Cell) {
  if (cell.kind === "yes")
    return (
      <Check
        className="size-5 text-accent-emerald"
        strokeWidth={3}
        aria-label="Yes"
      />
    )
  if (cell.kind === "no")
    return (
      <X
        className="size-5 text-[#CBD5E1]"
        strokeWidth={2.5}
        aria-label="No"
      />
    )
  return <span className="text-sm italic text-muted-ink">{cell.label}</span>
}

export function Comparison() {
  return (
    <section className="bg-surface-soft px-5 py-20 md:px-12 md:py-24">
      <div className="mx-auto max-w-5xl">
        <SectionHeader
          eyebrow="How We Compare"
          title={
            <>
              Why QAlaunch beats every
              <br className="hidden md:block" /> website checker you&apos;ve tried
            </>
          }
          align="center"
        />

        <motion.div
          className="mt-12 overflow-hidden rounded-2xl shadow-xl shadow-black/[0.06]"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Desktop table */}
          <table className="hidden w-full border-collapse md:table">
            <thead>
              <tr>
                <th className="bg-surface-soft px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted-ink">
                  Feature
                </th>
                <th className="bg-slate-deep px-6 py-4 text-left">
                  <span className="inline-flex items-center gap-2 font-heading text-sm font-extrabold text-white">
                    <Rocket className="size-4 text-accent-bright" />
                    QAlaunch
                  </span>
                </th>
                <th className="bg-[#F1F5F9] px-6 py-4 text-left font-heading text-sm font-extrabold text-muted-ink">
                  Other Tools
                </th>
              </tr>
            </thead>
            <motion.tbody
              variants={stagger(0.08, 0.05)}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
            >
              {rows.map((r, i) => (
                <motion.tr
                  key={r.feature}
                  variants={fadeUpSoft}
                  className={cn(
                    "transition-colors hover:bg-brand-pale/60",
                    i < rows.length - 1 && "border-b border-border-soft",
                  )}
                >
                  <td className="px-6 py-4 text-sm text-ink">{r.feature}</td>
                  <td className="px-6 py-4">{renderCell(r.qa)}</td>
                  <td className="px-6 py-4">{renderCell(r.others)}</td>
                </motion.tr>
              ))}
            </motion.tbody>
          </table>

          {/* Mobile card list */}
          <div className="divide-y divide-border-soft bg-white md:hidden">
            {rows.map((r) => (
              <div key={r.feature} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-4">
                <span className="text-sm text-ink">{r.feature}</span>
                <div
                  className="flex min-w-14 flex-col items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-brand"
                  aria-hidden="true"
                >
                  <span>QA</span>
                  {renderCell(r.qa)}
                </div>
                <div
                  className="flex min-w-14 flex-col items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-ink"
                  aria-hidden="true"
                >
                  <span>Others</span>
                  {renderCell(r.others)}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
