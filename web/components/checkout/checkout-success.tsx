"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import {
  CheckCircle2,
  Mail,
  AlertCircle,
  Download,
  RefreshCw,
  Loader2,
} from "lucide-react"

import { planForCheckoutPackage } from "@/components/pricing/pricing-plans"
import {
  allPagesAnalyzed,
  countInterimIssues,
  deriveScanProgressMessage,
} from "@/lib/scan/progressMessage"

// ─── Types ────────────────────────────────────────────────────────────────────

type ScanRow = {
  id: string
  url: string
  package: string
  status: "pending" | "crawling" | "analyzing" | "done" | "failed"
  payment_status: "free" | "pending" | "paid" | null
  user_email: string | null
  report_pdf_url: string | null
  error_message: string | null
}

type ScanPageStatus = {
  ai_analysis?: { status?: string; issues?: unknown[] } | null
}

type StatusPayload = {
  scan: ScanRow
  pages?: ScanPageStatus[]
}

// ─── Progress steps ───────────────────────────────────────────────────────────

type Step = {
  id: string
  label: string
  detail: string
  activeOn: ScanRow["status"][]
  doneOn: ScanRow["status"][]
}

const STEPS: Step[] = [
  {
    id: "queued",
    label: "Queued",
    detail: "Your audit is in the queue",
    activeOn: ["pending"],
    doneOn: ["crawling", "analyzing", "done"],
  },
  {
    id: "crawling",
    label: "Scanning pages",
    detail: "Running Playwright checks, screenshots & accessibility",
    activeOn: ["crawling"],
    doneOn: ["analyzing", "done"],
  },
  {
    id: "analyzing",
    label: "AI analysis",
    detail: "Claude is reviewing every page for issues",
    activeOn: ["analyzing"],
    doneOn: ["done"],
  },
  {
    id: "report",
    label: "Generating PDF report",
    detail: "Building your full audit report",
    activeOn: [],           // gated on report_pdf_url instead of status — see stepState
    doneOn: [],
  },
  {
    id: "email",
    label: "Sending to your inbox",
    detail: "Report emailed + download ready below",
    activeOn: [],
    doneOn: [],
  },
]

/**
 * Maps the scan status (and whether the PDF exists yet) to a step's visual state.
 *
 * The last two steps don't have their own DB status — the pipeline marks the scan
 * `done` only after the PDF is generated and the email is sent. So we treat
 * `done` WITHOUT a `report_pdf_url` as "still generating the PDF" (step 4 active),
 * and `done` WITH a `report_pdf_url` as fully complete.
 */
function stepState(
  step: Step,
  status: ScanRow["status"],
  hasPdf: boolean,
): "done" | "active" | "idle" {
  if (step.id === "report") {
    if (status !== "done") return "idle"
    return hasPdf ? "done" : "active"
  }
  if (step.id === "email") {
    if (status !== "done") return "idle"
    return hasPdf ? "done" : "idle"
  }
  if (step.doneOn.includes(status)) return "done"
  if (step.activeOn.includes(status)) return "active"
  return "idle"
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveHost(raw?: string | null) {
  if (!raw) return null
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`)
    return url.hostname
  } catch {
    return raw
  }
}

const POLL_INTERVAL_MS = 4_000
// Stop polling after 10 minutes and show a "taking longer than expected" notice.
const MAX_POLL_MS = 10 * 60 * 1_000

// ─── Main component ───────────────────────────────────────────────────────────

export function CheckoutSuccessExperience() {
  const params = useSearchParams()
  const scanId = params.get("scanId")

  const [scan, setScan] = useState<ScanRow | null>(null)
  const [pages, setPages] = useState<ScanPageStatus[] | null>(null)
  const [phase, setPhase] = useState<"loading" | "polling" | "done" | "failed" | "not_found" | "free_scan">("loading")
  const [timedOut, setTimedOut] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)
  // Bumped by the retry handler to restart polling from scratch.
  const [pollToken, setPollToken] = useState(0)
  // Drives cosmetic rotation of the crawl sub-labels within the real phase.
  const [rotateTick, setRotateTick] = useState(0)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const id = setInterval(() => setRotateTick((t) => t + 1), 2_500)
    return () => clearInterval(id)
  }, [])

  // Poll /api/scan/status/{scanId} until the report is ready (done + PDF) or it
  // fails. Starts immediately on load and repeats every POLL_INTERVAL_MS.
  useEffect(() => {
    // Render already shows the "invalid or expired link" state when scanId is
    // missing — no need to set state synchronously here.
    if (!scanId) return

    const startedAt = Date.now()

    const stop = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    const poll = async () => {
      // Hard timeout — leave the progress UI up but stop hammering the API and
      // surface a "taking longer than expected" message.
      if (Date.now() - startedAt > MAX_POLL_MS) {
        setTimedOut(true)
        stop()
        return
      }

      try {
        // Cache-busting query param: a unique URL per poll defeats any
        // CDN/route-cache that would otherwise serve a stale status. `no-store`
        // alone does not stop server/edge caches.
        const res = await fetch(
          `/api/scan/status/${scanId}?t=${Date.now()}`,
          { cache: "no-store" },
        )
        if (!res.ok) {
          // 404 = scan genuinely not found; anything else is likely transient.
          if (res.status === 404) {
            setPhase("not_found")
            stop()
          }
          return
        }

        const data = (await res.json()) as StatusPayload
        const s = data.scan
        if (!s) return

        if (s.package === "free") {
          setPhase("free_scan")
          stop()
          return
        }

        setScan(s)
        setPages(Array.isArray(data.pages) ? data.pages : null)

        if (s.status === "done" && s.report_pdf_url) {
          // Fully complete: report generated and ready to download.
          setPhase("done")
          stop()
        } else if (s.status === "failed") {
          setPhase("failed")
          stop()
        } else {
          // pending / crawling / analyzing, or done-but-PDF-not-written-yet:
          // keep polling.
          setPhase("polling")
        }
      } catch {
        // network blip — keep polling
      }
    }

    void poll()
    intervalRef.current = setInterval(() => void poll(), POLL_INTERVAL_MS)

    return stop
  }, [scanId, pollToken])

  // ── Retry handler ──────────────────────────────────────────────────────────

  const handleRetry = async () => {
    if (!scanId) return
    setRetrying(true)
    setRetryError(null)
    try {
      const res = await fetch("/api/scan/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId }),
      })
      const data = await res.json() as { ok?: boolean; message?: string }
      if (!res.ok) {
        setRetryError(data.message ?? "Retry failed. Please contact support.")
        setRetrying(false)
        return
      }
      // Reset to polling — the pipeline is restarting. Bumping pollToken
      // re-runs the polling effect (fresh interval + reset 10-min timeout).
      setScan((prev) => prev ? { ...prev, status: "pending", report_pdf_url: null, error_message: null } : prev)
      setPhase("polling")
      setTimedOut(false)
      setPollToken((n) => n + 1)
    } catch {
      setRetryError("Network error. Please try again or contact support.")
    } finally {
      setRetrying(false)
    }
  }

  // ── Guard states ───────────────────────────────────────────────────────────

  if (!scanId || phase === "not_found") {
    return (
      <div className="mx-auto max-w-lg px-5 py-16 text-center">
        <p className="font-heading text-lg font-bold text-ink">Invalid or expired link</p>
        <p className="mt-2 text-sm text-body">
          We couldn&apos;t confirm your order. If you just paid, check your email for
          your receipt and report link.
        </p>
        <p className="mt-4 text-sm text-muted-ink">
          Still stuck? Email us at{" "}
          <a href="mailto:support@getqalaunch.com" className="underline text-brand">
            support@getqalaunch.com
          </a>{" "}
          with your order details.
        </p>
        <Link
          href="/pricing"
          className="mt-6 inline-flex rounded-xl bg-brand px-5 py-3 text-sm font-extrabold text-white shadow-glow-brand hover:bg-brand-mid"
        >
          View plans
        </Link>
      </div>
    )
  }

  if (phase === "loading") {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center px-5 py-16">
        <div className="qa-spin size-12 rounded-full border-4 border-brand-pale border-t-brand" />
        <p className="mt-4 text-sm text-body">Confirming your order…</p>
      </div>
    )
  }

  if (phase === "free_scan") {
    return (
      <div className="mx-auto max-w-lg px-5 py-16 text-center">
        <p className="font-heading text-lg font-bold text-ink">Wrong page for free audits</p>
        <p className="mt-2 text-sm text-body">
          This confirmation page is for paid orders. Start a free preview from the homepage.
        </p>
        <Link href="/" className="mt-6 inline-flex rounded-xl bg-brand px-5 py-3 text-sm font-extrabold text-white shadow-glow-brand hover:bg-brand-mid">
          Back to home
        </Link>
      </div>
    )
  }

  // ── Main UI ────────────────────────────────────────────────────────────────

  const pkg = scan?.package ?? ""
  const plan = planForCheckoutPackage(pkg)
  const tierLabel = plan?.tier ?? pkg.replace(/^./, (c) => c.toUpperCase())
  const host = deriveHost(scan?.url ?? null)
  const isPaid = scan?.payment_status === "paid"
  const currentStatus = scan?.status ?? "pending"
  const hasPdf = Boolean(scan?.report_pdf_url)

  // Real-state live status line, sourced from the same poll as the steps above.
  const progressMessage = deriveScanProgressMessage({
    status: currentStatus,
    host,
    pageCount: pages?.length ?? null,
    interimIssueCount: countInterimIssues(pages),
    allPagesAnalyzed: allPagesAnalyzed(pages),
    hasReport: hasPdf,
    isPaid: true,
    rotateTick,
  })

  return (
    <div className="mx-auto max-w-xl px-5 py-14 md:py-20">
      <div className="rounded-2xl border border-accent-pale bg-white p-8 shadow-card md:p-10">

        {/* Header */}
        <div className="flex justify-center">
          {phase === "failed" ? (
            <span className="flex size-16 items-center justify-center rounded-full bg-red-50 text-red-500">
              <AlertCircle className="size-9" strokeWidth={2} />
            </span>
          ) : phase === "done" ? (
            <span className="flex size-16 items-center justify-center rounded-full bg-accent-pale text-accent-emerald">
              <CheckCircle2 className="size-9" strokeWidth={2} />
            </span>
          ) : (
            <span className="flex size-16 items-center justify-center rounded-full bg-brand-pale">
              <Loader2 className="size-9 animate-spin text-brand" strokeWidth={2} />
            </span>
          )}
        </div>

        <h1 className="mt-6 text-center font-heading text-[clamp(1.5rem,4vw,2rem)] font-black leading-tight text-ink">
          {phase === "done"
            ? "Report ready!"
            : phase === "failed"
            ? "Scan failed"
            : "Audit in progress…"}
        </h1>

        <p className="mt-3 text-center text-[15px] leading-relaxed text-body">
          {phase === "done" ? (
            <>
              Your <span className="font-semibold text-ink">{tierLabel}</span> report
              {host ? <> for <span className="font-mono font-semibold text-ink">{host}</span></> : null}{" "}
              is complete. Download below or check your inbox.
            </>
          ) : phase === "failed" ? (
            <>
              Something went wrong while scanning{" "}
              {host ? <span className="font-mono font-semibold text-ink">{host}</span> : "your site"}.
              {isPaid ? " Use the retry button below — no extra charge." : ""}
            </>
          ) : (
            <>
              Your <span className="font-semibold text-ink">{tierLabel}</span> audit
              {host ? <> for <span className="font-mono font-semibold text-ink">{host}</span></> : null}{" "}
              is running.{" "}
              <span className="font-semibold text-ink">
                You can close this page — we&apos;ll email your report
                {scan?.user_email ? <> to <span className="break-all font-mono">{scan.user_email}</span></> : null}{" "}
                as soon as it&apos;s ready. No need to wait here.
              </span>
            </>
          )}
        </p>

        {/* Live status line (real pipeline state) */}
        {phase !== "done" && phase !== "failed" && progressMessage && (
          <div className="mt-6 flex items-center justify-center gap-3 rounded-xl border border-brand/20 bg-brand-pale/40 px-5 py-3.5">
            <Loader2 className="size-4 shrink-0 animate-spin text-brand" strokeWidth={2.5} />
            <p className="text-sm font-semibold text-ink">{progressMessage}</p>
          </div>
        )}

        {/* Progress steps */}
        {phase !== "failed" && (
          <div className="mt-8 space-y-3">
            {STEPS.map((step) => {
              const state = stepState(step, currentStatus, hasPdf)
              return (
                <div key={step.id} className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {state === "done" ? (
                      <CheckCircle2 className="size-5 text-accent-emerald" strokeWidth={2.5} />
                    ) : state === "active" ? (
                      <Loader2 className="size-5 animate-spin text-brand" strokeWidth={2.5} />
                    ) : (
                      <div className="size-5 rounded-full border-2 border-border-soft" />
                    )}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold leading-tight ${state === "idle" ? "text-muted-ink" : "text-ink"}`}>
                      {step.label}
                    </p>
                    {state === "active" && (
                      <p className="mt-0.5 text-xs text-body">{step.detail}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Done: download + email confirmation */}
        {phase === "done" && (
          <div className="mt-8 space-y-3">
            {scan?.report_pdf_url && (
              <a
                href={`/api/scan/report-url?scanId=${scanId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-extrabold text-white shadow-glow-brand hover:bg-brand-mid"
              >
                <Download className="size-4" strokeWidth={2.5} />
                Download PDF report
              </a>
            )}
            <div className="rounded-xl border border-border-soft bg-surface-soft px-4 py-4 text-center">
              <div className="flex items-center justify-center gap-2 text-sm font-semibold text-ink">
                <Mail className="size-4 shrink-0 text-brand" strokeWidth={2.5} />
                Report sent to your inbox
              </div>
              {scan?.user_email && (
                <p className="mt-1 break-all font-mono text-xs text-muted-ink">{scan.user_email}</p>
              )}
            </div>
          </div>
        )}

        {/* Failed: retry + error */}
        {phase === "failed" && (
          <div className="mt-8 space-y-4">
            {isPaid && (
              <button
                onClick={() => void handleRetry()}
                disabled={retrying}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-extrabold text-white shadow-glow-brand hover:bg-brand-mid disabled:opacity-60"
              >
                {retrying ? (
                  <Loader2 className="size-4 animate-spin" strokeWidth={2.5} />
                ) : (
                  <RefreshCw className="size-4" strokeWidth={2.5} />
                )}
                {retrying ? "Restarting scan…" : "Retry audit — no extra charge"}
              </button>
            )}
            {retryError && (
              <p className="text-center text-xs text-red-500">{retryError}</p>
            )}
            {scan?.error_message && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-xs text-red-600">
                {scan.error_message}
              </p>
            )}
          </div>
        )}

        {/* Polling: email reminder (or "taking longer than expected" after timeout) */}
        {phase === "polling" && (
          <div className="mt-8 rounded-xl border border-border-soft bg-surface-soft px-4 py-4 text-center">
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-ink">
              <Mail className="size-4 shrink-0 text-brand" strokeWidth={2.5} />
              Watch your inbox
            </div>
            {scan?.user_email && (
              <p className="mt-1 break-all font-mono text-xs text-muted-ink">{scan.user_email}</p>
            )}
            {timedOut ? (
              <p className="mt-3 text-sm leading-snug text-body">
                This is <span className="font-semibold text-ink">taking longer than expected</span>.
                Your report is still processing — we&apos;ll email it to you as soon as it&apos;s
                ready, so you can safely close this page.
              </p>
            ) : (
              <p className="mt-3 text-sm leading-snug text-body">
                Most reports arrive within{" "}
                <span className="font-semibold text-ink">5 minutes</span>.{" "}
                <span className="font-semibold text-ink">
                  You can close this page — we&apos;ll email your report
                  {scan?.user_email ? <> to {scan.user_email}</> : ""} as soon as it&apos;s
                  ready. No need to wait here.
                </span>
              </p>
            )}
          </div>
        )}

        {/* Support note — always visible */}
        <div className="mt-6 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-center text-xs text-amber-800">
          <span className="font-semibold">Didn&apos;t receive your report after 10 minutes?</span>{" "}
          Check your spam folder, then email{" "}
          <a href="mailto:support@getqalaunch.com" className="font-semibold underline">
            support@getqalaunch.com
          </a>{" "}
          with your order ID:{" "}
          <span className="font-mono">{scanId?.slice(0, 8)}…</span>
          {isPaid && " — paid users get priority support and a free retry."}
        </div>

        {/* Footer links */}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-border-soft bg-white px-5 text-sm font-bold text-ink hover:border-brand hover:text-brand"
          >
            Back to home
          </Link>
          {phase === "done" && scan?.id && (
            <Link
              href={`/result?scanId=${scan.id}`}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-extrabold text-white shadow-glow-brand hover:bg-brand-mid"
            >
              View full results
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
