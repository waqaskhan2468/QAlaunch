"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
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
import { computeHealthScore, labelFromScore } from "@/lib/scoring/health"

const checklistSteps = [
  "Testing usability & UI/UX patterns…",
  "Checking all interactive functionality…",
  "Testing mobile responsiveness…",
  "Measuring performance & Core Web Vitals…",
  "Analysing SEO, security & trust signals…",
]

type UiState =
  | "idle"
  | "starting"
  | "processing"
  | "completed"
  | "failed"
  | "free_preview_used"

type ScanIssue = {
  id: string
  category: string
  severity: string
  title: string
  description: string
  impact: string
}

type ScanStatusResponse = {
  scan: {
    id: string
    status: "pending" | "crawling" | "analyzing" | "done" | "failed"
    error_message?: string | null
    package?: string
  }
  issues: ScanIssue[]
  lockedIssues: Array<{ id: string; category: string; severity: string; isLocked: true }>
  totalIssueCount: number
  visibleIssueCount: number
  lockedIssueCount: number
  healthScore?: number
  healthGrade?: string
  healthLabel?: string
  previewHealthScore?: number
}

function scoreTone(score: number): { ring: string; label: string } {
  if (score >= 80) return { ring: "border-accent-bright", label: "Good" }
  if (score >= 60) return { ring: "border-warn", label: "Needs attention" }
  return { ring: "border-danger", label: "Critical issues" }
}

function loadingCopyForStatus(status: ScanStatusResponse["scan"]["status"] | null): {
  title: string
  subtitle: string
  stageLabel: string
  stepCount: number
} {
  if (status === "pending") {
    return {
      title: "Starting your free audit…",
      subtitle: "We queued your scan and are preparing website checks.",
      stageLabel: "Queued",
      stepCount: 1,
    }
  }

  if (status === "crawling") {
    return {
      title: "Scanning your website…",
      subtitle: "Collecting pages, UI states, and performance signals.",
      stageLabel: "Crawling pages",
      stepCount: 3,
    }
  }

  if (status === "analyzing") {
    return {
      title: "Analyzing findings…",
      subtitle: "Reviewing severity, impact, and developer fix guidance.",
      stageLabel: "AI analysis",
      stepCount: checklistSteps.length,
    }
  }

  return {
    title: "Auditing your website…",
    subtitle: "Preparing your free preview report.",
    stageLabel: "Initializing",
    stepCount: 1,
  }
}

const fallbackFindings: ScanIssue[] = [
  {
    id: "fallback-1",
    severity: "critical",
    category: "functionality",
    title: "Contact form submits with no confirmation or error message",
    description:
      "On the Homepage, in the Contact section, when the user submits the contact form the page reloads silently with no success or failure feedback. Users cannot tell if their message was received, which causes repeated attempts and trust loss.",
    impact:
      "Potential customers may abandon contact attempts, reducing leads and conversions.",
  },
  {
    id: "fallback-2",
    severity: "high",
    category: "usability_ux",
    title: "Navigation menu disappears when user scrolls down the page",
    description:
      "On long pages, the top navigation disappears after scrolling and users must return to the top to access other sections. This adds friction to normal browsing behavior and hurts discoverability of key pages.",
    impact:
      "Higher frustration and drop-off, especially for mobile visitors on long pages.",
  },
  {
    id: "fallback-3",
    severity: "high",
    category: "responsiveness",
    title: "Primary CTA button is hidden on smaller mobile screens",
    description:
      "On narrow viewports, the main call-to-action can be pushed below fold and partially obscured by sticky UI, making it hard to discover or tap for users on smaller devices.",
    impact:
      "Mobile conversion intent is blocked, directly impacting sales and signups.",
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
  const router = useRouter()
  const params = useSearchParams()
  const inputUrl = params.get("url")
  const initialScanId = params.get("scanId")
  const freePreviewUsedParam = params.get("freePreviewUsed")
  const host = deriveHost(inputUrl)

  const [uiState, setUiState] = useState<UiState>("idle")
  const [completedSteps, setCompletedSteps] = useState(0)
  const [statusData, setStatusData] = useState<ScanStatusResponse | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const legacyPreviewMode = false

  useEffect(() => {
    let cancelled = false

    const delay = (ms: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, ms)
      })

    const pollScanStatus = async (currentScanId: string) => {
      let retryCount = 0
      while (!cancelled) {
        try {
          const res = await fetch(`/api/scan/status/${currentScanId}`, {
            method: "GET",
            cache: "no-store",
          })

          if (!res.ok) {
            const errorPayload = (await res.json().catch(() => null)) as
              | { error?: string; message?: string }
              | null
            throw new Error(
              errorPayload?.message ??
                errorPayload?.error ??
                "Could not fetch scan status.",
            )
          }

          const data = (await res.json()) as ScanStatusResponse
          if (cancelled) return

          setStatusData(data)
          setCompletedSteps(loadingCopyForStatus(data.scan.status).stepCount)
          setUiState("processing")
          retryCount = 0

          if (data.scan.status === "done") {
            setUiState("completed")
            return
          }

          if (data.scan.status === "failed") {
            setUiState("failed")
            setMessage(
              data.scan.error_message ??
                "Scan failed before completion. Please try again.",
            )
            return
          }
        } catch (error) {
          retryCount += 1
          if (retryCount >= 3) {
            setUiState("failed")
            setMessage(
              error instanceof Error
                ? error.message
                : "Could not retrieve scan status. Please retry.",
            )
            return
          }
        }

        await delay(3000)
      }
    }

    const resumeOnly = async () => {
      if (freePreviewUsedParam === "1") {
        setUiState("free_preview_used")
        setMessage("You already used your free preview for this website.")
        return
      }

      if (!initialScanId) {
        router.replace("/#audit-input")
        return
      }

      try {
        const res = await fetch(`/api/scan/status/${initialScanId}`, {
          method: "GET",
          cache: "no-store",
        })
        if (res.ok) {
          const data = (await res.json()) as ScanStatusResponse
          const pkg = data.scan?.package
          if (pkg && pkg !== "free") {
            router.replace(
              `/checkout/success?scanId=${encodeURIComponent(initialScanId)}`,
            )
            return
          }
        }
      } catch {
        /* continue — free preview may still load */
      }

      if (!inputUrl) {
        router.replace("/#audit-input")
        return
      }

      setUiState("processing")
      setCompletedSteps(1)
      await pollScanStatus(initialScanId)
    }

    resumeOnly()

    return () => {
      cancelled = true
    }
  }, [freePreviewUsedParam, initialScanId, inputUrl, router])

  const loadingStatus = statusData?.scan.status ?? null
  const loadingCopy = loadingCopyForStatus(loadingStatus)

  if (uiState === "starting" || uiState === "processing" || uiState === "idle") {
    return (
      <section className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-surface-soft px-5 py-16">
        <div className="w-full max-w-xl text-center">
          <div className="qa-spin mx-auto mb-5 size-16 rounded-full border-4 border-brand-pale border-t-brand" />
          <h1 className="font-heading text-[22px] font-black text-ink">
            {loadingCopy.title}
          </h1>
          <p className="mt-1.5 text-sm text-body">
            {loadingCopy.subtitle}{" "}
            <span className="font-mono text-ink">({host})</span>
          </p>
          <div className="mt-3 inline-flex items-center rounded-full border border-brand/20 bg-brand-pale px-3 py-1 text-xs font-semibold text-brand">
            Current stage: {loadingCopy.stageLabel}
          </div>
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

  if (uiState === "free_preview_used") {
    return (
      <section className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-surface-soft px-5 py-16">
        <div className="w-full max-w-xl rounded-2xl border border-warn/30 bg-white p-7 text-center shadow-sm">
          <h1 className="font-heading text-2xl font-black text-ink">
            Free preview already used
          </h1>
          <p className="mt-2 text-sm text-body">
            {message ??
              "You have already used the free preview for this website."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/pricing"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-extrabold text-white hover:bg-brand-mid"
            >
              View paid plans
            </Link>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-border-soft bg-white px-5 text-sm font-bold text-ink hover:border-brand hover:text-brand"
            >
              Try another website
            </button>
          </div>
        </div>
      </section>
    )
  }

  if (uiState === "failed") {
    return (
      <section className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-surface-soft px-5 py-16">
        <div className="w-full max-w-xl rounded-2xl border border-danger/20 bg-white p-7 text-center shadow-sm">
          <h1 className="font-heading text-2xl font-black text-ink">
            Audit could not complete
          </h1>
          <p className="mt-2 text-sm text-body">
            {message ?? "Please retry your audit in a moment."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-extrabold text-white hover:bg-brand-mid"
            >
              Retry audit
            </button>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-border-soft bg-white px-5 text-sm font-bold text-ink hover:border-brand hover:text-brand"
            >
              Back to home
            </button>
          </div>
        </div>
      </section>
    )
  }

  const findings = legacyPreviewMode ? fallbackFindings : (statusData?.issues ?? [])
  const totalIssueCount = legacyPreviewMode
    ? 12
    : (statusData?.totalIssueCount ?? findings.length)
  const lockedIssueCount = legacyPreviewMode
    ? 9
    : (statusData?.lockedIssueCount ?? 0)
  const allKnownSeverities = legacyPreviewMode
    ? fallbackFindings.map((item) => item.severity)
    : [
        ...(statusData?.issues ?? []).map((item) => item.severity),
        ...(statusData?.lockedIssues ?? []).map((item) => item.severity),
      ]
  const healthScore =
    statusData?.healthScore ?? computeHealthScore(allKnownSeverities)
  const healthTone = scoreTone(healthScore)
  const healthLabel = statusData?.healthLabel ?? labelFromScore(healthScore) ?? healthTone.label
  const previewHealthScore = statusData?.previewHealthScore

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
                Scan completed · {totalIssueCount} total issues found
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-slate-deep px-5 py-3">
            <div
              className={cn(
                "flex size-12 flex-col items-center justify-center rounded-full border-[3px]",
                healthTone.ring,
              )}
            >
              <span className="font-heading text-lg font-black leading-none text-white">
                {healthScore}
              </span>
              <span className="text-[9px] font-extrabold text-white/80">
                SCORE
              </span>
            </div>
            <div>
              <div className="text-sm font-bold text-white">Health Score</div>
              <div className="mt-0.5 text-xs text-white/45">
                {healthLabel}
              </div>
              {!legacyPreviewMode && typeof previewHealthScore === "number" ? (
                <div className="mt-0.5 text-[11px] text-white/60">
                  Preview-only score: {previewHealthScore}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-5xl px-5 py-12 md:px-12">
        {/* Alert */}
        <div className="mb-7 flex items-start gap-3 rounded-2xl border border-warn/30 bg-linear-to-br from-warn-pale to-[#FFF9E5] p-5">
          <AlertTriangle className="size-5 shrink-0 text-warn" />
          <div>
            <div className="text-[14.5px] font-extrabold text-[#92400E]">
              {totalIssueCount} issues found affecting your users
            </div>
            <p className="mt-1 text-[13px] leading-snug text-[#78350F]">
              3 critical user-facing issues are shown below for free. These are
              actively affecting how real visitors experience your website right
              now. Unlock the full report to see all {totalIssueCount} with screenshot
              evidence and developer fix instructions.
            </p>
          </div>
        </div>

        <h2 className="font-heading text-[22px] font-black text-ink">
          Your free preview — 3 most critical findings
        </h2>
        <p className="mt-1.5 text-sm text-body">
          Upgrade to see all {totalIssueCount} issues with screenshot evidence and
          step-by-step developer fix instructions.
        </p>
        {!legacyPreviewMode ? (
          <p className="mt-1 text-xs text-muted-ink">
            Health score is based on full scan results. You are currently viewing
            3 free preview issues.
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-3">
          {findings.map((f) => (
            <FindingCard key={f.title} finding={f} />
          ))}
        </div>

        {/* Locked teaser */}
        <div className="mt-9 overflow-hidden rounded-2xl border-[1.5px] border-dashed border-border-soft bg-white px-6 py-9 text-center">
          <div className="pointer-events-none mb-5 flex flex-col gap-2.5 opacity-30 blur-xs">
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
              <Lock className="size-5 text-muted-ink" />
              {lockedIssueCount} more issues found
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
            <MiniPlanCard
              key={plan.tier}
              plan={plan}
              prefillUrl={inputUrl}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function FindingCard({
  finding,
}: {
  finding: ScanIssue
}) {
  const normalizeSeverity = (value: string) => value.toUpperCase()
  const normalizeCategory = (value: string) => {
    const map: Record<string, string> = {
      functionality: "Functionality",
      ui_bugs: "UI Bugs",
      usability_ux: "Usability",
      responsiveness: "Mobile",
      performance: "Performance",
      seo: "SEO",
      accessibility: "Accessibility",
      security: "Security",
      content: "Content",
    }
    return map[value] ?? value
  }

  const severity = normalizeSeverity(finding.severity)
  const severityTone = {
    CRITICAL: {
      card: "border-l-[4px] border-l-danger",
      badge: "bg-danger-pale text-danger",
    },
    HIGH: {
      card: "border-l-[4px] border-l-warn",
      badge: "bg-warn-pale text-warn",
    },
    MEDIUM: {
      card: "border-l-[4px] border-l-brand",
      badge: "bg-brand-pale text-brand",
    },
    LOW: {
      card: "border-l-[4px] border-l-muted-ink",
      badge: "bg-surface-soft text-muted-ink",
    },
  }[severity] ?? {
    card: "border-l-[4px] border-l-brand",
    badge: "bg-brand-pale text-brand",
  }

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
          ● {severity}
        </span>
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-ink">
          {normalizeCategory(finding.category)}
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

function MiniPlanCard({
  plan,
  prefillUrl,
}: {
  plan: (typeof plans)[number]
  prefillUrl: string | null
}) {
  const checkoutHref =
    plan.checkoutPackage != null
      ? `/checkout?package=${plan.checkoutPackage}${
          prefillUrl
            ? `&url=${encodeURIComponent(prefillUrl)}`
            : ""
        }`
      : "/contact"

  return (
    <article
      className={cn(
        "relative flex flex-col rounded-2xl border bg-white p-5 transition-all hover:-translate-y-1 hover:border-brand hover:shadow-xl hover:shadow-brand/10",
        plan.popular
          ? "border-brand border-2 bg-linear-to-b from-brand-pale to-white"
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
        href={checkoutHref}
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
