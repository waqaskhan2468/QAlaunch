"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
} from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { initializePaddle } from "@paddle/paddle-js"
import { Check, ClipboardList, Lock, Zap } from "lucide-react"
import { z } from "zod"

import { cn } from "@/lib/utils"
import { isValidPublicWebsiteUrl } from "@/lib/validation/url"
import {
  planForCheckoutPackage,
  type CheckoutPackageSlug,
} from "@/components/pricing/pricing-plans"
import {
  paddleClientToken,
  paddlePriceIdForPackage,
} from "@/lib/checkout/paddle-client"

const SELF_SERVE: CheckoutPackageSlug[] = ["basic", "standard", "premium"]

type ScanStartPaidResponse = {
  ok: true
  scanId: string
  paymentRequired: true
  targetUrl: string
}

/** Keeps the URL field aligned with `?url=` when it is set or updated; ignores removal so user edits are preserved. */
function useCheckoutWebsiteUrl(prefilledUrl: string) {
  const [url, setUrl] = useState(prefilledUrl)

  useEffect(() => {
    if (!prefilledUrl) return
    startTransition(() => {
      setUrl(prefilledUrl)
    })
  }, [prefilledUrl])

  return [url, setUrl] as const
}

function validationMessageForCheckout(url: string, email: string): string | null {
  const trimmed = url.trim()
  if (!trimmed) return "Enter your website URL."
  if (!isValidPublicWebsiteUrl(trimmed)) return "Enter a valid public website URL."
  const emailTrim = email.trim()
  if (!emailTrim) return "Enter your email address."
  if (!z.string().email().safeParse(emailTrim).success) {
    return "Enter a valid email address."
  }
  return null
}

export function CheckoutExperience() {
  const searchParams = useSearchParams()
  const rawPkg = (searchParams.get("package") ?? "").toLowerCase()
  const prefilledUrl = searchParams.get("url") ?? ""

  const plan = useMemo(() => planForCheckoutPackage(rawPkg), [rawPkg])

  const [url, setUrl] = useCheckoutWebsiteUrl(prefilledUrl)
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPaying, setIsPaying] = useState(false)
  // Message from the pre-scan gate when the homepage looks like a web app —
  // drives the "public pages only" confirmation interstitial.
  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null)

  const fetchAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      fetchAbortRef.current?.abort()
    }
  }, [])

  const handlePay = useCallback(async (acknowledgePublicOnly = false) => {
    if (!plan) return

    const msg = validationMessageForCheckout(url, email)
    if (msg) {
      setError(msg)
      return
    }

    fetchAbortRef.current?.abort()
    const ac = new AbortController()
    fetchAbortRef.current = ac

    const trimmed = url.trim()
    const emailTrim = email.trim()

    setError(null)
    setPendingConfirm(null)
    setIsPaying(true)

    try {
      const startRes = await fetch("/api/scan/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ac.signal,
        body: JSON.stringify({
          url: trimmed,
          package: plan.checkoutPackage,
          email: emailTrim,
          ...(acknowledgePublicOnly ? { acknowledgePublicOnly: true } : {}),
        }),
      })

      const startPayload = (await startRes.json()) as
        | ScanStartPaidResponse
        | { ok: false; code?: string; message?: string }

      // Pre-scan gate: homepage looks like a web app. Pause and ask the user to
      // confirm we'll only test public-facing pages before payment.
      if (
        startPayload.ok === false &&
        startPayload.code === "confirm_public_only"
      ) {
        setPendingConfirm(
          startPayload.message ??
            "This looks like a web application with user accounts. QAlaunch tests public-facing pages only — nothing behind login. Continue, or cancel?",
        )
        return
      }

      if (
        !startRes.ok ||
        startPayload.ok !== true ||
        !("paymentRequired" in startPayload) ||
        !startPayload.paymentRequired ||
        !startPayload.scanId ||
        !startPayload.targetUrl
      ) {
        const errMsg =
          typeof startPayload === "object" &&
          startPayload &&
          "message" in startPayload &&
          typeof startPayload.message === "string"
            ? startPayload.message
            : "Could not start checkout. Try again."
        throw new Error(errMsg)
      }

      const clientToken = paddleClientToken()
      const priceId = paddlePriceIdForPackage(plan.checkoutPackage)
      if (!clientToken || !priceId) {
        throw new Error(
          "Payment configuration is missing. Set NEXT_PUBLIC_PADDLE_CLIENT_TOKEN and NEXT_PUBLIC_PADDLE_*_PRICE_ID in your environment.",
        )
      }

      const paddle = await initializePaddle({
        token: clientToken,
        environment:
          process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === "production"
            ? "production"
            : "sandbox",
      })

      if (!paddle) {
        throw new Error("Payment library failed to load.")
      }

      const successUrl = `${window.location.origin}/checkout/success?scanId=${encodeURIComponent(startPayload.scanId)}`

      paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        customData: {
          scanId: startPayload.scanId,
          package: plan.checkoutPackage,
          targetUrl: startPayload.targetUrl,
          userEmail: emailTrim,
        },
        settings: {
          displayMode: "overlay",
          theme: "light",
          successUrl,
        },
        customer: { email: emailTrim },
      })
    } catch (e) {
      if (ac.signal.aborted) return
      setError(e instanceof Error ? e.message : "Something went wrong.")
    } finally {
      setIsPaying(false)
    }
  }, [email, plan, url])

  const invalidPackage =
    !SELF_SERVE.includes(rawPkg as CheckoutPackageSlug) || !plan

  if (invalidPackage) {
    return (
      <div className="mx-auto max-w-lg px-5 py-24 text-center">
        <p className="font-heading text-lg font-bold text-ink">Choose a plan</p>
        <p className="mt-2 text-body">
          Pick Basic, Standard, or Premium on the pricing page.
        </p>
        <Link
          href="/pricing"
          className="mt-6 inline-flex rounded-xl bg-brand px-5 py-3 text-sm font-extrabold text-white shadow-glow-brand hover:bg-brand-mid focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/35"
        >
          View pricing
        </Link>
      </div>
    )
  }

  const DeliveryIcon = plan.delivery.icon === "bolt" ? Zap : ClipboardList

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-16 lg:py-20">
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
        <article
          className={cn(
            "relative flex flex-col rounded-2xl border bg-white p-6 shadow-card md:p-8",
            plan.popular
              ? "border-brand border-2 bg-linear-to-b from-brand-pale to-white"
              : "border-border-soft",
          )}
        >
          {plan.popular && (
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand px-3 py-0.5 text-[10.5px] font-extrabold text-white">
              Most popular
            </span>
          )}
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-ink">
            Your plan
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-1">
            <span className="font-heading text-2xl font-black text-ink">
              {plan.tier}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-1">
            {plan.priceSymbol && (
              <span className="font-heading text-2xl font-bold text-muted-ink">
                {plan.priceSymbol}
              </span>
            )}
            <span
              className={cn(
                "font-heading font-black leading-none text-ink",
                plan.price === "Custom" ? "text-4xl" : "text-5xl",
              )}
            >
              {plan.price}
            </span>
          </div>
          <div className="relative mt-1.5 text-sm text-body">{plan.pages}</div>

          <div
            className={cn(
              "relative mt-3 inline-flex w-fit items-center gap-1 rounded-full px-3 py-1 text-xs font-bold",
              plan.delivery.icon === "bolt"
                ? "bg-accent-pale text-accent-emerald"
                : "bg-[#E0E7FF] text-[#3730A3]",
            )}
          >
            <DeliveryIcon className="size-3" />
            {plan.delivery.label}
          </div>

          <div className="relative my-5 h-px bg-border-soft" />

          <ul className="relative flex flex-1 flex-col divide-y divide-border-soft">
            {plan.features.map((f) => (
              <li
                key={f}
                className="flex items-start gap-2 py-2 text-sm leading-snug text-ink"
              >
                <Check
                  className="mt-0.5 size-3.5 shrink-0 text-accent-bright"
                  strokeWidth={3}
                />
                {f}
              </li>
            ))}
          </ul>
        </article>

        <div className="flex flex-col justify-center">
          <h2 className="font-heading text-2xl font-black text-ink md:text-3xl">
            Complete purchase
          </h2>
          <p className="mt-2 text-body">
            Enter the site to audit and your email for the PDF receipt. After
            payment, your full report starts immediately.
          </p>

          <form
            className="contents"
            onSubmit={(e) => {
              e.preventDefault()
              void handlePay()
            }}
          >
            <label className="mt-8 block">
              <span className="text-sm font-semibold text-ink">
                Website URL <span className="text-danger">*</span>
              </span>
              <input
                type="url"
                name="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://yoursite.com"
                autoComplete="url"
                required
                className="mt-2 w-full rounded-xl border border-border-soft bg-white px-4 py-3 font-mono text-sm text-ink shadow-sm outline-none transition placeholder:text-muted-ink focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/20"
              />
            </label>

            <label className="mt-5 block">
              <span className="text-sm font-semibold text-ink">
                Email <span className="text-danger">*</span>
              </span>
              <input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                required
                className="mt-2 w-full rounded-xl border border-border-soft bg-white px-4 py-3 text-sm text-ink shadow-sm outline-none transition placeholder:text-muted-ink focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/20"
              />
            </label>

            {error && (
              <p
                className="mt-4 rounded-xl border border-danger/25 bg-danger-pale px-4 py-3 text-sm font-semibold text-danger"
                role="alert"
              >
                {error}
              </p>
            )}

            <div className="mt-8 flex flex-col gap-3">
              <button
                type="submit"
                disabled={isPaying}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-extrabold text-white shadow-glow-brand transition hover:bg-brand-mid focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/35 disabled:pointer-events-none disabled:opacity-65"
              >
                {isPaying ? (
                  <>
                    <span
                      className="qa-spin size-4 shrink-0 rounded-full border-2 border-white/35 border-t-white"
                      aria-hidden
                    />
                    Opening checkout…
                  </>
                ) : (
                  <>
                    <Lock className="size-4 shrink-0 opacity-95" strokeWidth={2.5} />
                    Continue to payment
                  </>
                )}
              </button>
              <Link
                href="/pricing"
                className="text-center text-sm font-semibold text-brand hover:underline"
              >
                Change plan
              </Link>
            </div>
          </form>

          <p className="mt-5 text-center text-xs leading-relaxed text-body sm:text-left">
            Paddle handles payment securely. One-time charge — no subscription.
          </p>
        </div>
      </div>

      {pendingConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 px-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-border-soft bg-white p-6 shadow-card">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-pale px-3 py-1 text-xs font-bold text-brand">
              <Lock className="size-3" strokeWidth={2.5} />
              Public pages only
            </div>
            <h3 className="font-heading text-xl font-black text-ink">
              This looks like a web application
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-body">
              {pendingConfirm}
            </p>
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row-reverse">
              <button
                type="button"
                onClick={() => void handlePay(true)}
                disabled={isPaying}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-brand px-4 text-sm font-extrabold text-white transition hover:bg-brand-mid focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/35 disabled:pointer-events-none disabled:opacity-65"
              >
                {isPaying ? "Starting…" : "Continue with public pages"}
              </button>
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                disabled={isPaying}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-border-soft bg-white px-4 text-sm font-bold text-ink transition hover:border-brand hover:text-brand disabled:opacity-65"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
