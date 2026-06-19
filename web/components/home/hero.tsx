"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Check, Link2, Mail, Star } from "lucide-react"
import { motion, useMotionValue, useSpring } from "motion/react"

import { cn } from "@/lib/utils"
import { fadeUp, stagger } from "@/components/motion/primitives"
import { isValidPublicWebsiteUrl } from "@/lib/validation/url"
import { Flag } from "@/components/home/flag"

/**
 * Hero split — marketing copy + URL capture on the left over navy, an audit
 * report preview + rating card on the right over a pale-mint panel. A green
 * angular flag runs down the diagonal seam between the two halves.
 */
export function Hero() {
  const router = useRouter()
  const [url, setUrl] = useState("")
  const [email, setEmail] = useState("")
  const [isStarting, setIsStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  useEffect(() => {
    if (window.location.hash !== "#audit-input") return

    const input = document.getElementById("audit-input") as HTMLInputElement | null
    if (!input) return

    const timer = window.setTimeout(() => {
      input.focus({ preventScroll: true })
      input.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 120)

    return () => window.clearTimeout(timer)
  }, [])

  const submit = async () => {
    const raw = url.trim()
    if (!raw || isStarting) return
    if (!isValidPublicWebsiteUrl(raw)) {
      setStartError("Please enter a valid public website URL.")
      return
    }

    const value =
      raw.startsWith("http://") || raw.startsWith("https://")
        ? raw
        : `https://${raw}`

    // NOTE: once we enter a redirecting path, `isStarting` is intentionally left
    // `true` so the button stays disabled + in its loading state until the new
    // page takes over. We only flip it back to `false` on a failure path (so the
    // user can fix the URL and retry) — never after a successful redirect, which
    // is what previously caused the button to flicker back to clickable.
    try {
      setIsStarting(true)
      setStartError(null)

      const trimmedEmail = email.trim()

      const res = await fetch("/api/scan/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: value,
          package: "free",
          ...(trimmedEmail ? { email: trimmedEmail } : {}),
        }),
      })

      const payload = (await res.json()) as
        | { ok: true; scanId: string }
        | { ok: false; code?: string; message?: string }

      if (
        res.status === 409 &&
        payload.ok === false &&
        payload.code === "free_preview_used"
      ) {
        const target = `/result?url=${encodeURIComponent(value)}&freePreviewUsed=1`
        router.push(target)
        return // keep loading state — redirect in flight
      }

      if (payload.ok !== true || !payload.scanId) {
        // Validation failed (blocklist, rate limit, unreachable URL, web-app
        // page, …). Surface the precise reason and re-enable so they can retry.
        setStartError(
          (payload.ok === false && payload.message) ||
            "Could not start your free audit. Please try again.",
        )
        setIsStarting(false)
        return
      }

      const target = `/result?url=${encodeURIComponent(value)}&scanId=${encodeURIComponent(payload.scanId)}`
      router.push(target)
      // keep loading state — redirect in flight
    } catch {
      setStartError("Could not start your free audit. Please try again.")
      setIsStarting(false)
    }
  }

  return (
    <section className="relative flex min-h-[calc(100vh-4rem)] items-center overflow-hidden bg-slate-deep px-5 py-16 sm:px-8 md:px-12 md:py-20 lg:py-0">
      {/* Decorative dot grid on the navy half */}
      <div className="qa-hero-grid pointer-events-none absolute inset-0" />

      {/* Diagonal mint panel + green flag seam (desktop only). Two stacked
          clipped layers share the same slope: the green layer sits behind and
          the mint layer is offset right, revealing a constant green band. */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 lg:block">
        <div
          className="absolute inset-0 bg-accent-bright"
          style={{ clipPath: "polygon(11% 0, 100% 0, 100% 100%, -1% 100%)" }}
        />
        <div
          className="absolute inset-0 bg-accent-mint"
          style={{ clipPath: "polygon(15% 0, 100% 0, 100% 100%, 3% 100%)" }}
        />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
        {/* ── Left: copy + capture (over navy) ───────────────────────────── */}
        <motion.div
          className="flex flex-col py-2 lg:py-24"
          variants={stagger(0.08, 0.1)}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={fadeUp} className="mb-7">
            <Flag>9 Years of QA Expertise — Now Automated</Flag>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="font-heading text-[clamp(2.25rem,5.2vw,4rem)] font-black leading-[1.05] tracking-[-0.03em] text-balance text-white"
          >
            Is your website{" "}
            <span className="relative inline-block text-accent-bright">
              actually working
              <motion.span
                aria-hidden="true"
                className="absolute inset-x-0 -bottom-1 h-[3px] origin-left rounded-none bg-accent-bright/80"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{
                  delay: 0.8,
                  duration: 0.7,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
            </span>{" "}
            for your customers?
            <span className="mt-4 block font-heading text-[clamp(1.05rem,2.2vw,1.5rem)] font-bold text-white/55">
              The AI website audit &amp; QA testing tool, built by a senior QA
              engineer.
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mt-6 max-w-xl text-base leading-relaxed text-white/65 sm:text-lg"
          >
            Get a free expert website audit in 120 seconds. We test usability,
            broken functionality, UI bugs, mobile responsiveness, and SEO — then
            give you a clear, actionable report your developer can fix today.
          </motion.p>

          {/* URL capture — sharp bordered input boxes */}
          <motion.div variants={fadeUp} className="mt-10">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                <UrlInput value={url} onChange={setUrl} onSubmit={submit} />
                <EmailInput value={email} onChange={setEmail} onSubmit={submit} />
              </div>
              <MagneticButton onClick={submit} isLoading={isStarting} />
            </div>
            {startError ? (
              <p className="mt-3 px-1 text-xs font-semibold text-[#fca5a5]">
                {startError}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 px-1">
              <TrustItem label="No signup required" />
              <TrustItem label="Free preview in 120s" />
              <TrustItem label="Full report from $9" />
            </div>
          </motion.div>

          {/* Stats — dominant big numbers */}
          <motion.div
            variants={fadeUp}
            className="mt-12 grid grid-cols-2 gap-x-8 gap-y-7 sm:flex sm:flex-wrap sm:gap-x-12"
          >
            <StatItem value={1000} suffix="+" label="Websites Audited" />
            <StatItem value={35} suffix="+" label="Quality Checks" />
            <StatItem value={60} suffix="s" label="Free Audit Time" />
            <StatItem value={9} suffix="yr" label="QA Expertise" />
          </motion.div>
        </motion.div>

        {/* ── Right: report preview + rating (over mint) ─────────────────── */}
        <motion.div
          className="relative hidden flex-col gap-5 lg:flex lg:py-24 lg:pl-10 xl:pl-16"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <ReportCard />
          <RatingCard />
        </motion.div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  URL input                                                          */
/* ------------------------------------------------------------------ */

function UrlInput({
  value,
  onChange,
  onSubmit,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
}) {
  return (
    <div className="relative flex items-center sm:flex-[3]">
      <Link2 className="pointer-events-none absolute left-4 size-4 text-muted-ink" />
      <input
        id="audit-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit()
        }}
        type="url"
        placeholder="https://yourwebsite.com"
        className={cn(
          "h-14 w-full rounded-none border-2 border-slate-deep bg-white pl-11 pr-4",
          "font-mono text-base text-ink outline-none transition-colors placeholder:text-muted-ink",
          "focus:border-accent-bright focus:ring-4 focus:ring-accent-bright/20",
        )}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Email input (optional)                                             */
/* ------------------------------------------------------------------ */

function EmailInput({
  value,
  onChange,
  onSubmit,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
}) {
  return (
    <div className="relative flex items-center sm:flex-[2]">
      <Mail className="pointer-events-none absolute left-4 size-4 text-muted-ink" />
      <input
        id="audit-email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit()
        }}
        type="email"
        autoComplete="email"
        placeholder="Email (optional)"
        aria-label="Email (optional)"
        className={cn(
          "h-14 w-full rounded-none border-2 border-slate-deep bg-white pl-11 pr-4",
          "text-base text-ink outline-none transition-colors placeholder:text-muted-ink",
          "focus:border-accent-bright focus:ring-4 focus:ring-accent-bright/20",
        )}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Magnetic CTA button — follows cursor with a spring                  */
/* ------------------------------------------------------------------ */

function MagneticButton({
  onClick,
  isLoading,
}: {
  onClick: () => void
  isLoading: boolean
}) {
  const ref = useRef<HTMLButtonElement | null>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 180, damping: 16, mass: 0.4 })
  const springY = useSpring(y, { stiffness: 180, damping: 16, mass: 0.4 })

  const onMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const relX = e.clientX - (rect.left + rect.width / 2)
    const relY = e.clientY - (rect.top + rect.height / 2)
    x.set(relX * 0.25)
    y.set(relY * 0.3)
  }

  const reset = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={isLoading}
      aria-busy={isLoading}
      onMouseMove={isLoading ? undefined : onMove}
      onMouseLeave={reset}
      whileTap={isLoading ? undefined : { scale: 0.98 }}
      style={{ x: springX, y: springY }}
      className={cn(
        "group inline-flex h-14 w-full items-center justify-center gap-2 whitespace-nowrap rounded-none bg-accent-bright px-7 sm:px-8",
        "text-sm font-extrabold tracking-wide text-white shadow-glow-accent sm:text-lg",
        "hover:bg-accent-emerald hover:shadow-glow-accent-lg",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-bright/35",
        "disabled:cursor-not-allowed disabled:opacity-80",
      )}
    >
      {isLoading ? (
        <>
          <span
            className="qa-spin size-4 shrink-0 rounded-full border-2 border-white/35 border-t-white"
            aria-hidden
          />
          Starting audit…
        </>
      ) : (
        <>
          Audit My Website Free
          <motion.span
            className="inline-flex"
            animate={{ x: [0, 3, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          >
            <ArrowRight className="size-4" />
          </motion.span>
        </>
      )}
    </motion.button>
  )
}

/* ------------------------------------------------------------------ */
/*  Trust + stat items                                                 */
/* ------------------------------------------------------------------ */

function TrustItem({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium text-white/50">
      <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-none bg-accent-bright/20 text-[#4ade80]">
        <Check className="size-2.5" strokeWidth={3} />
      </span>
      {label}
    </div>
  )
}

function StatItem({
  value,
  suffix,
  label,
}: {
  value: number
  suffix: string
  label: string
}) {
  const [display, setDisplay] = useState(0)
  const ref = useRef<HTMLDivElement | null>(null)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || started.current) return
          started.current = true
          const duration = 1400
          const start = performance.now()
          const tick = (now: number) => {
            const t = Math.min(1, (now - start) / duration)
            const eased = 1 - Math.pow(1 - t, 3)
            setDisplay(Math.round(value * eased))
            if (t < 1) requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        })
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [value])

  return (
    <div ref={ref} className="flex flex-col">
      <span className="font-heading text-4xl font-black leading-none tracking-[-0.02em] text-white sm:text-5xl">
        {display >= 1000 ? display.toLocaleString() : display}
        {suffix}
      </span>
      <span className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-white/45">
        {label}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Report preview card (light, sharp, over the mint panel)             */
/* ------------------------------------------------------------------ */

const bars = [
  { label: "Usability", value: 45, color: "#ef4444" },
  { label: "UI / UX", value: 62, color: "#f97316" },
  { label: "Functionality", value: 51, color: "#ef4444" },
  { label: "Mobile", value: 70, color: "#f59e0b" },
  { label: "Performance", value: 82, color: "#22c55e" },
]

const issues = [
  {
    severity: "CRITICAL",
    cat: "Functionality",
    title: "Contact form submits with no confirmation",
    border: "border-l-danger",
    badge: "bg-danger/15 text-danger",
  },
  {
    severity: "HIGH",
    cat: "Usability",
    title: "Navigation disappears on scroll",
    border: "border-l-warn",
    badge: "bg-warn/15 text-warn",
  },
  {
    severity: "CRITICAL",
    cat: "Mobile",
    title: "CTA button invisible on iPhone SE",
    border: "border-l-danger",
    badge: "bg-danger/15 text-danger",
  },
]

function ReportCard() {
  return (
    <div className="rounded-none border-2 border-slate-deep bg-white shadow-[8px_8px_0_0_rgba(9,17,31,1)]">
      {/* Browser chrome */}
      <div className="flex items-center gap-2.5 border-b-2 border-slate-deep bg-surface-soft px-4 py-3">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-[#FF5F57]" />
          <span className="size-2.5 rounded-full bg-[#FFBD2E]" />
          <span className="size-2.5 rounded-full bg-[#28CA41]" />
        </div>
        <div className="flex-1 rounded-none bg-white px-3 py-1 font-mono text-xs text-muted-ink">
          yourwebsite.com — Live Audit
        </div>
      </div>

      <div className="p-5">
        {/* Score row */}
        <div className="mb-4 flex items-center gap-3.5 border-b border-border-soft pb-4">
          <div className="flex size-14 flex-col items-center justify-center rounded-none border-2 border-warn">
            <span className="font-heading text-xl font-black leading-none text-ink">
              58
            </span>
            <span className="text-[9px] font-bold text-warn">C+</span>
          </div>
          <div>
            <div className="text-sm font-bold text-ink">
              Health Score: Needs Attention
            </div>
            <div className="mt-0.5 text-[11px] text-muted-ink">
              12 issues found across 6 categories
            </div>
          </div>
        </div>

        {/* Progress bars */}
        <div className="mb-4 flex flex-col gap-2">
          {bars.map((b) => (
            <div key={b.label} className="flex items-center gap-2.5">
              <span className="w-[84px] shrink-0 text-[11px] text-body">
                {b.label}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-none bg-border-soft">
                <div
                  className="h-full rounded-none"
                  style={{ backgroundColor: b.color, width: `${b.value}%` }}
                />
              </div>
              <span className="w-7 text-right font-mono text-[11px] text-body">
                {b.value}
              </span>
            </div>
          ))}
        </div>

        {/* Issue rows */}
        <div className="flex flex-col gap-2">
          {issues.map((iss) => (
            <div
              key={iss.title}
              className={cn(
                "rounded-none border border-border-soft border-l-[3px] bg-surface-soft p-3",
                iss.border,
              )}
            >
              <div className="mb-1 flex items-center gap-1.5">
                <span
                  className={cn(
                    "rounded-none px-2 py-0.5 text-[9.5px] font-extrabold tracking-wider",
                    iss.badge,
                  )}
                >
                  {iss.severity}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-muted-ink">
                  {iss.cat}
                </span>
              </div>
              <div className="text-xs font-bold leading-snug text-ink">
                {iss.title}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Rating card — real testimonial (James M.)                           */
/* ------------------------------------------------------------------ */

function RatingCard() {
  return (
    <figure className="rounded-none border-2 border-slate-deep bg-white p-5">
      <div className="mb-3 flex gap-0.5 text-[#F59E0B]" aria-label="5 star rating">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className="size-4" fill="currentColor" strokeWidth={0} />
        ))}
      </div>
      <blockquote className="text-[13px] italic leading-relaxed text-ink">
        &ldquo;I thought my Lovable app was ready to launch. QAlaunch found a
        broken checkout button, an invisible CTA on mobile, and 3 JS errors — all
        in under a minute. Saved me from a disastrous launch.&rdquo;
      </blockquote>
      <figcaption className="mt-4 flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-full bg-brand font-heading text-xs font-extrabold text-white">
          JM
        </div>
        <div>
          <div className="text-[13px] font-bold text-ink">James M.</div>
          <div className="text-[11px] text-muted-ink">
            SaaS Founder — Built with Lovable
          </div>
        </div>
      </figcaption>
    </figure>
  )
}
