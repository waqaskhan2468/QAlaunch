"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import {
  AlertTriangle,
  Check,
  Clock,
  Globe2,
  Lock,
  Zap,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { plans } from "@/components/pricing/pricing-plans"

const checklistSteps = [
  "Testing usability & UI/UX patterns…",
  "Checking all interactive functionality…",
  "Testing mobile responsiveness…",
  "Measuring performance & Core Web Vitals…",
  "Analysing SEO, security & trust signals…",
]

const findings = [
  {
    severity: "CRITICAL" as const,
    category: "Functionality",
    title: "Contact form submits with no confirmation or error message",
    description:
      "On the Homepage, in the Contact section, when the user submits the contact form the page reloads silently — no success message, no error feedback, and no email is delivered. Users have no way to know if their message was received, leading to repeated submissions and damaged trust.",
    impact:
      "Potential customers who tried to contact you may have given up, believing your business is unresponsive.",
  },
  {
    severity: "HIGH" as const,
    category: "Usability",
    title: "Navigation menu disappears when user scrolls down the page",
    description:
      "On all pages, the top navigation bar disappears once the user scrolls past the hero section. This means users must scroll all the way back to the top to navigate to a different page — creating unnecessary friction on every single visit. Standard expectation and best practice is for the navigation to remain sticky (fixed) at the top at all times.",
    impact:
      "Users experience significant navigation friction, increasing frustration and exit rate — especially on long pages and mobile.",
  },
  {
    severity: "HIGH" as const,
    category: "Mobile",
    title:
      "Primary CTA button invisible on iPhone SE and small Android screens",
    description:
      "On screen widths under 390px — which includes iPhone SE, iPhone 12 Mini, and many Android devices — the primary call-to-action button is pushed below the fold and covered by the sticky navigation bar. The action you most want users to take is invisible to a large percentage of your mobile visitors.",
    impact:
      "Mobile visitors on smaller screens cannot convert. This is directly costing you sales across 30–40% of your traffic.",
  },
]

function deriveHost(raw?: string | null) {
  if (!raw) return "yourwebsite.com"
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`)
    return url.hostname
  } catch {
    return raw
  }
}

/**
 * The audit experience. Plays a scripted 4s "analysing" animation and
 * then reveals a preview of 3 critical findings plus locked full-report
 * teasers and a compact pricing grid.
 */
export function AuditExperience() {
  const params = useSearchParams()
  const inputUrl = params.get("url")
  const host = deriveHost(inputUrl)

  const [completedSteps, setCompletedSteps] = useState(0)
  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    const timers = checklistSteps.map((_, i) =>
      setTimeout(() => setCompletedSteps(i + 1), (i + 1) * 680),
    )
    const reveal = setTimeout(() => setShowResults(true), 4000)
    return () => {
      timers.forEach(clearTimeout)
      clearTimeout(reveal)
    }
  }, [])

  if (!showResults) {
    return (
      <section className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-surface-soft px-5 py-16">
        <div className="w-full max-w-xl text-center">
          <div className="qa-spin mx-auto mb-5 size-16 rounded-full border-[4px] border-brand-pale border-t-brand" />
          <h1 className="font-heading text-[22px] font-black text-ink">
            Auditing your website…
          </h1>
          <p className="mt-1.5 text-sm text-body">
            Running usability, UI, functionality &amp; performance checks on{" "}
            <span className="font-mono text-ink">{host}</span>
          </p>
          <div className="mt-7 flex flex-col gap-2 text-left">
            {checklistSteps.map((label, i) => {
              const done = i < completedSteps
              return (
                <div
                  key={label}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-4 py-3 text-[13.5px] transition-colors",
                    done
                      ? "border-accent-pale bg-[#F9FFFE] text-ink"
                      : "border-border-soft bg-white text-body",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full",
                      done
                        ? "bg-accent-bright text-white"
                        : "bg-surface-soft text-muted-ink",
                    )}
                  >
                    {done ? (
                      <Check className="size-3" strokeWidth={3} />
                    ) : (
                      <Clock className="size-3" />
                    )}
                  </span>
                  {label}
                </div>
              )
            })}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-surface-soft">
      {/* Summary bar */}
      <div className="border-b border-border-soft bg-white px-5 py-6 md:px-12">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-pale text-brand">
              <Globe2 className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate font-mono text-sm font-semibold text-ink">
                {host}
              </div>
              <div className="mt-0.5 text-xs text-muted-ink">
                Audited just now · 35 checks completed
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-slate-deep px-5 py-3">
            <div className="flex size-12 flex-col items-center justify-center rounded-full border-[3px] border-warn">
              <span className="font-heading text-lg font-black leading-none text-white">
                58
              </span>
              <span className="text-[9px] font-extrabold text-warn">C+</span>
            </div>
            <div>
              <div className="text-sm font-bold text-white">Health Score</div>
              <div className="mt-0.5 text-xs text-white/45">
                Needs attention
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-5xl px-5 py-12 md:px-12">
        {/* Alert */}
        <div className="mb-7 flex items-start gap-3 rounded-2xl border border-warn/30 bg-gradient-to-br from-warn-pale to-[#FFF9E5] p-5">
          <AlertTriangle className="size-5 shrink-0 text-warn" />
          <div>
            <div className="text-[14.5px] font-extrabold text-[#92400E]">
              12 issues found affecting your users
            </div>
            <p className="mt-1 text-[13px] leading-snug text-[#78350F]">
              3 critical user-facing issues are shown below for free. These are
              actively affecting how real visitors experience your website right
              now. Unlock the full report to see all 12 with screenshot
              evidence and developer fix instructions.
            </p>
          </div>
        </div>

        <h2 className="font-heading text-[22px] font-black text-ink">
          Your free preview — 3 most critical findings
        </h2>
        <p className="mt-1.5 text-sm text-body">
          Upgrade to see all 12 issues with screenshot evidence and
          step-by-step developer fix instructions.
        </p>

        <div className="mt-5 flex flex-col gap-3">
          {findings.map((f) => (
            <FindingCard key={f.title} finding={f} />
          ))}
        </div>

        {/* Locked teaser */}
        <div className="mt-9 overflow-hidden rounded-2xl border-[1.5px] border-dashed border-border-soft bg-white px-6 py-9 text-center">
          <div className="pointer-events-none mb-5 flex flex-col gap-2.5 opacity-30 blur-[4px]">
            {[
              { dot: "bg-danger", a: "62%", b: "78%" },
              { dot: "bg-warn", a: "70%", b: "52%" },
              { dot: "bg-brand", a: "55%", b: "72%" },
            ].map((row, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl bg-surface-soft px-4 py-4"
              >
                <span className={cn("size-2.5 rounded-full", row.dot)} />
                <div className="flex-1 space-y-1">
                  <div
                    className="h-2 rounded bg-border-soft"
                    style={{ width: row.a }}
                  />
                  <div
                    className="h-2 rounded bg-border-soft"
                    style={{ width: row.b }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="inline-flex items-center gap-2 font-heading text-[22px] font-black text-ink">
              <Lock className="size-5 text-muted-ink" />9 more issues found
            </div>
            <div className="text-sm text-body">
              Unlock all findings + screenshot evidence + developer fix
              instructions
            </div>
          </div>
        </div>

        {/* Compact pricing */}
        <h2 className="mt-12 text-center font-heading text-[24px] font-black text-ink">
          Choose your full audit report
        </h2>
        <p className="mt-1.5 text-center text-sm text-body">
          PDF delivered to your inbox instantly. Share directly with your
          developer or Fiverr freelancer.
        </p>

        <div className="mt-7 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <MiniPlanCard key={plan.tier} plan={plan} />
          ))}
        </div>
      </div>
    </section>
  )
}

function FindingCard({
  finding,
}: {
  finding: (typeof findings)[number]
}) {
  const severityTone = {
    CRITICAL: {
      card: "border-l-[4px] border-l-danger",
      badge: "bg-danger-pale text-danger",
    },
    HIGH: {
      card: "border-l-[4px] border-l-warn",
      badge: "bg-warn-pale text-warn",
    },
  }[finding.severity]

  return (
    <article
      className={cn(
        "rounded-2xl border-[1.5px] border-border-soft bg-white p-6 transition-shadow hover:shadow-lg hover:shadow-black/5",
        severityTone.card,
      )}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-wider",
            severityTone.badge,
          )}
        >
          ● {finding.severity}
        </span>
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-ink">
          {finding.category}
        </span>
      </div>
      <h3 className="font-heading text-base font-extrabold text-ink">
        {finding.title}
      </h3>
      <p className="mt-2 text-[13.5px] leading-[1.62] text-body">
        {finding.description}
      </p>
      <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-warn-pale px-3.5 py-2.5 text-[12.5px] font-semibold text-[#78350F]">
        <Zap className="mt-0.5 size-3.5 shrink-0 text-warn" />
        <span>
          <span className="font-extrabold">Impact:</span> {finding.impact}
        </span>
      </div>
    </article>
  )
}

function MiniPlanCard({ plan }: { plan: (typeof plans)[number] }) {
  return (
    <article
      className={cn(
        "relative flex flex-col rounded-2xl border bg-white p-5 transition-all hover:-translate-y-1 hover:border-brand hover:shadow-xl hover:shadow-brand/10",
        plan.popular
          ? "border-brand border-2 bg-gradient-to-b from-brand-pale to-white"
          : "border-border-soft",
      )}
    >
      {plan.popular && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand px-3 py-0.5 text-[10.5px] font-extrabold text-white">
          ⭐ Most Popular
        </span>
      )}
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-ink">
        {plan.tier}
      </div>
      <div className="mt-1 font-heading text-2xl font-black text-ink">
        {plan.priceSymbol ? `${plan.priceSymbol}${plan.price}` : plan.price}{" "}
        <span className="text-sm font-medium text-muted-ink">
          {plan.price === "Custom" ? "quote" : "one-time"}
        </span>
      </div>
      <div className="mt-0.5 text-xs text-body">{plan.pages}</div>

      <ul className="my-3.5 flex flex-1 flex-col gap-1.5">
        {plan.features.slice(0, 4).map((f) => (
          <li
            key={f}
            className="flex items-start gap-1.5 text-[12px] text-ink"
          >
            <Check
              className="mt-0.5 size-3 shrink-0 text-accent-bright"
              strokeWidth={3}
            />
            {f}
          </li>
        ))}
      </ul>
      <Link
        href={plan.tier === "Enterprise" ? "/contact" : "/pricing"}
        className={cn(
          "mt-auto inline-flex w-full items-center justify-center rounded-xl px-3 py-2.5 text-[13px] font-extrabold transition-all",
          plan.popular
            ? "bg-brand text-white hover:bg-brand-mid"
            : "border border-border-soft bg-white text-ink hover:border-brand hover:text-brand",
        )}
      >
        Get {plan.tier}
      </Link>
    </article>
  )
}
