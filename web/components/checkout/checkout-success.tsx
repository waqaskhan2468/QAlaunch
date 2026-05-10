"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { CheckCircle2, Mail } from "lucide-react"

import { planForCheckoutPackage } from "@/components/pricing/pricing-plans"

type ScanRow = {
  package?: string
  url?: string
  user_email?: string | null
  payment_status?: string | null
}

type StatusPayload = {
  scan: ScanRow
}

function deriveHost(raw?: string | null) {
  if (!raw) return null
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`)
    return url.hostname
  } catch {
    return raw
  }
}

export function CheckoutSuccessExperience() {
  const params = useSearchParams()
  const scanId = params.get("scanId")

  const [phase, setPhase] = useState<"loading" | "ready" | "not_found" | "free_scan">(
    "loading",
  )
  const [scan, setScan] = useState<ScanRow | null>(null)

  useEffect(() => {
    if (!scanId) {
      setPhase("not_found")
      return
    }

    let cancelled = false

    const run = async () => {
      try {
        const res = await fetch(`/api/scan/status/${scanId}`, {
          method: "GET",
          cache: "no-store",
        })
        if (cancelled) return

        if (!res.ok) {
          setPhase("not_found")
          return
        }

        const data = (await res.json()) as StatusPayload
        if (cancelled) return

        if (data.scan?.package === "free") {
          setPhase("free_scan")
          return
        }

        setScan(data.scan)
        setPhase("ready")
      } catch {
        if (!cancelled) setPhase("not_found")
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [scanId])

  if (!scanId || phase === "not_found") {
    return (
      <div className="mx-auto max-w-lg px-5 py-16 text-center">
        <p className="font-heading text-lg font-bold text-ink">Invalid or expired link</p>
        <p className="mt-2 text-sm text-body">
          We couldn&apos;t confirm your order from this URL. If you just paid, check your email
          for your receipt and report link.
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
        <Link
          href="/"
          className="mt-6 inline-flex rounded-xl bg-brand px-5 py-3 text-sm font-extrabold text-white shadow-glow-brand hover:bg-brand-mid"
        >
          Back to home
        </Link>
      </div>
    )
  }

  const pkg = scan?.package ?? ""
  const plan = planForCheckoutPackage(pkg)
  const tierLabel = plan?.tier ?? pkg.replace(/^./, (c) => c.toUpperCase())
  const host = deriveHost(scan?.url ?? null)

  return (
    <div className="mx-auto max-w-xl px-5 py-14 md:py-20">
      <div className="rounded-2xl border border-accent-pale bg-white p-8 shadow-card md:p-10">
        <div className="flex justify-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-accent-pale text-accent-emerald">
            <CheckCircle2 className="size-9" strokeWidth={2} />
          </span>
        </div>
        <h1 className="mt-6 text-center font-heading text-[clamp(1.5rem,4vw,2rem)] font-black leading-tight text-ink">
          Payment successful
        </h1>
        <p className="mt-3 text-center text-[15px] leading-relaxed text-body">
          Thank you — your <span className="font-semibold text-ink">{tierLabel}</span> audit
          {host ? (
            <>
              {" "}
              for <span className="font-mono font-semibold text-ink">{host}</span>
            </>
          ) : null}{" "}
          is queued. We&apos;ll email your PDF report with a secure download link.
        </p>
        <div className="mt-6 rounded-xl border border-border-soft bg-surface-soft px-4 py-4 text-center">
          <div className="flex items-center justify-center gap-2 text-sm font-semibold text-ink">
            <Mail className="size-4 shrink-0 text-brand" strokeWidth={2.5} />
            Watch your inbox
          </div>
          {scan?.user_email ? (
            <p className="mt-1 break-all font-mono text-xs text-muted-ink">{scan.user_email}</p>
          ) : null}
          <p className="mt-3 text-sm leading-snug text-body">
            Most reports arrive within <span className="font-semibold text-ink">about 5 minutes</span>
            . During busy periods it can take a little longer — your receipt and report link will
            come from the same purchase flow.
          </p>
        </div>
        <p className="mt-6 text-center text-xs text-muted-ink">
          Didn&apos;t get an email? Check spam, or contact support with your order details.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-border-soft bg-white px-5 text-sm font-bold text-ink hover:border-brand hover:text-brand"
          >
            Back to home
          </Link>
          <Link
            href="/pricing"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-extrabold text-white shadow-glow-brand hover:bg-brand-mid"
          >
            Pricing
          </Link>
        </div>
      </div>
    </div>
  )
}
