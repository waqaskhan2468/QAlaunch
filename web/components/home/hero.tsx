"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Check } from "lucide-react"
import { motion, useMotionValue, useSpring, useTransform } from "motion/react"

import { cn } from "@/lib/utils"
import { fadeUp, stagger } from "@/components/motion/primitives"
import { isValidPublicWebsiteUrl } from "@/lib/validation/url"

/**
 * Hero split — marketing copy + URL capture on the left, an animated
 * live-audit dashboard on the right. Uses motion for a staggered entrance,
 * magnetic button feedback, mouse-parallax on the dashboard, and a spring
 * counter on each stat.
 */
export function Hero() {
  const router = useRouter()
  const [url, setUrl] = useState("")
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

    try {
      setIsStarting(true)
      setStartError(null)

      const res = await fetch("/api/scan/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: value,
          package: "free",
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
        return
      }

      if (!res.ok || payload.ok !== true || !payload.scanId) {
        throw new Error("Could not start free audit.")
      }

      const target = `/result?url=${encodeURIComponent(value)}&scanId=${encodeURIComponent(payload.scanId)}`
      router.push(target)
    } catch {
      setStartError("Could not start your free audit. Please try again.")
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <section className="relative flex min-h-[calc(100vh-4rem)] items-center overflow-hidden bg-slate-deep px-5 py-16 sm:px-8 md:px-12 md:py-20 lg:py-24">
      {/* Decorative dot grid + glowing orbs */}
      <div className="qa-hero-grid pointer-events-none absolute inset-0" />
      <div className="qa-orb-float pointer-events-none absolute -left-32 -top-32 size-[600px] rounded-full bg-[radial-gradient(circle,rgba(24,71,168,0.5)_0%,transparent_65%)]" />
      <div className="qa-orb-float-alt pointer-events-none absolute -bottom-40 -right-28 size-[500px] rounded-full bg-[radial-gradient(circle,rgba(34,197,94,0.2)_0%,transparent_60%)]" />

      <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-16 xl:gap-20">
        <motion.div
          className="flex flex-col"
          variants={stagger(0.08, 0.1)}
          initial="hidden"
          animate="visible"
        >
          {/* Live badge with pulse ring */}
          <motion.div
            variants={fadeUp}
            className="mb-7 inline-flex w-fit items-center gap-2 rounded-full border border-accent-bright/25 bg-accent-bright/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#4ade80]"
          >
            <span className="relative flex size-[7px]">
              <motion.span
                className="absolute inset-0 rounded-full bg-[#4ade80]"
                animate={{ scale: [1, 2.4, 1], opacity: [0.55, 0, 0.55] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
              />
              <span className="relative inline-flex size-full rounded-full bg-[#4ade80]" />
            </span>
            9 Years of QA Expertise — Now Automated
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="font-heading text-[clamp(2.25rem,5.2vw,4rem)] font-black leading-[1.05] tracking-tight text-balance text-white"
          >
            Is your website{" "}
            <span className="relative inline-block text-accent-bright">
              actually working
              <motion.span
                aria-hidden="true"
                className="absolute inset-x-0 -bottom-1 h-[3px] origin-left rounded-full bg-accent-bright/80"
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

          {/* URL capture */}
          <motion.div
            variants={fadeUp}
            className="mt-10 rounded-2xl border border-white/15 bg-white/6 p-3 shadow-surface-dark sm:p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
              <UrlInput value={url} onChange={setUrl} onSubmit={submit} />
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

          {/* Stats */}
          <motion.div
            variants={fadeUp}
            className="mt-10 grid grid-cols-2 gap-6 sm:flex sm:flex-wrap sm:gap-8"
          >
            <StatItem value={1000} suffix="+" label="Websites Audited" />
            <StatItem value={35} suffix="+" label="Quality Checks" />
            <StatItem value={60} suffix="s" label="Free Audit Time" />
            <StatItem value={9} suffix="yr" label="QA Expertise" />
          </motion.div>
        </motion.div>

        {/* Animated dashboard mock */}
        <motion.div
          className="relative hidden lg:block"
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.25, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <DashboardMock />
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
    <div className="relative flex-1">
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
          "h-14 w-full rounded-xl border border-white/15 bg-white/10 px-5",
          "font-mono text-base text-white outline-none transition-all placeholder:text-white/35",
          "focus:border-accent-bright focus:bg-accent-bright/10 focus:ring-4 focus:ring-accent-bright/15",
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
      onMouseMove={onMove}
      onMouseLeave={reset}
      whileTap={{ scale: 0.96 }}
      style={{ x: springX, y: springY }}
      className={cn(
        "group inline-flex h-14 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-accent-bright px-7 sm:px-8",
        "text-sm font-extrabold tracking-wide text-white shadow-glow-accent",
        "hover:bg-accent-emerald hover:shadow-glow-accent-lg",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-bright/35",
        "disabled:cursor-not-allowed disabled:opacity-80",
      )}
    >
      {isLoading ? "Starting audit..." : "Audit My Website Free"}
      <motion.span
        className="inline-flex"
        animate={{ x: [0, 3, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      >
        <ArrowRight className="size-4" />
      </motion.span>
    </motion.button>
  )
}

/* ------------------------------------------------------------------ */
/*  Trust + stat items                                                 */
/* ------------------------------------------------------------------ */

function TrustItem({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium text-white/50">
      <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-accent-bright/20 text-[#4ade80]">
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
    <motion.div
      ref={ref}
      whileHover={{ y: -2 }}
      className="group border-l-2 border-white/10 pl-4 transition-colors hover:border-accent-bright/60"
    >
      <span className="block font-heading text-2xl font-black leading-none text-white sm:text-[26px]">
        {display >= 1000 ? display.toLocaleString() : display}
        {suffix}
      </span>
      <span className="mt-1.5 block text-[11px] uppercase tracking-wider text-white/45">
        {label}
      </span>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Dashboard mock with mouse parallax                                  */
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
    tone: { border: "border-l-danger", badge: "bg-danger/20 text-[#fca5a5]" },
  },
  {
    severity: "HIGH",
    cat: "Usability",
    title: "Navigation disappears on scroll",
    tone: { border: "border-l-warn", badge: "bg-warn/20 text-[#fcd34d]" },
  },
  {
    severity: "CRITICAL",
    cat: "Mobile",
    title: "CTA button invisible on iPhone SE",
    tone: { border: "border-l-danger", badge: "bg-danger/20 text-[#fca5a5]" },
  },
  {
    severity: "MEDIUM",
    cat: "UI / UX",
    title: "Low contrast text in hero section",
    tone: {
      border: "border-l-[#60a5fa]",
      badge: "bg-brand/20 text-[#93c5fd]",
    },
  },
]

function DashboardMock() {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const rx = useSpring(useTransform(py, [-1, 1], [6, -6]), {
    stiffness: 150,
    damping: 18,
  })
  const ry = useSpring(useTransform(px, [-1, 1], [-8, 8]), {
    stiffness: 150,
    damping: 18,
  })

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    px.set(((e.clientX - rect.left) / rect.width) * 2 - 1)
    py.set(((e.clientY - rect.top) / rect.height) * 2 - 1)
  }

  const reset = () => {
    px.set(0)
    py.set(0)
  }

  return (
    <motion.div
      ref={wrapRef}
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={{
        rotateX: rx,
        rotateY: ry,
        transformPerspective: 1200,
        transformStyle: "preserve-3d",
      }}
      className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl shadow-black/50"
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-2.5 border-b border-white/10 bg-white/5 px-4 py-3">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-[#FF5F57]" />
          <span className="size-2.5 rounded-full bg-[#FFBD2E]" />
          <span className="size-2.5 rounded-full bg-[#28CA41]" />
        </div>
        <div className="flex-1 rounded-md bg-white/10 px-3 py-1 font-mono text-xs text-white/40">
          yourwebsite.com — Live Audit
        </div>
      </div>

      <div className="p-5">
        {/* Score row */}
        <div className="mb-4 flex items-center gap-3.5 border-b border-white/10 pb-4">
          <motion.div
            className="flex size-14 flex-col items-center justify-center rounded-full border-[3px] border-warn"
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.6, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="font-heading text-xl font-black leading-none text-white">
              58
            </span>
            <span className="text-[9px] font-bold text-warn">C+</span>
          </motion.div>
          <div>
            <div className="text-sm font-bold text-white">
              Health Score: Needs Attention
            </div>
            <div className="mt-0.5 text-[11px] text-white/40">
              12 issues found across 6 categories
            </div>
          </div>
        </div>

        {/* Progress bars */}
        <div className="mb-4 flex flex-col gap-2">
          {bars.map((b, i) => (
            <div key={b.label} className="flex items-center gap-2.5">
              <span className="w-[84px] shrink-0 text-[11px] text-white/50">
                {b.label}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: b.color }}
                  initial={{ width: "0%" }}
                  animate={{ width: `${b.value}%` }}
                  transition={{
                    delay: 0.5 + i * 0.12,
                    duration: 0.9,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                />
              </div>
              <span className="w-7 text-right font-mono text-[11px] text-white/50">
                {b.value}
              </span>
            </div>
          ))}
        </div>

        {/* Issue cards */}
        <div className="flex flex-col gap-2">
          {issues.map((iss, i) => (
            <motion.div
              key={iss.title}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.3 + i * 0.18, duration: 0.45 }}
              whileHover={{ x: 4 }}
              className={cn(
                "rounded-xl border-l-[3px] bg-white/5 p-3",
                iss.tone.border,
              )}
            >
              <div className="mb-1 flex items-center gap-1.5">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[9.5px] font-extrabold tracking-wider",
                    iss.tone.badge,
                  )}
                >
                  {iss.severity}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-white/40">
                  {iss.cat}
                </span>
              </div>
              <div className="text-xs font-bold leading-snug text-white">
                {iss.title}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Platform chips */}
        <div className="mt-5 flex flex-wrap items-center gap-2.5 border-t border-white/10 pt-4">
          <span className="whitespace-nowrap text-[10px] uppercase tracking-widest text-white/30">
            Tested on:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {["Lovable", "Bolt.new", "Replit", "Shopify", "Any website"].map(
              (p) => (
                <span
                  key={p}
                  className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/50"
                >
                  {p}
                </span>
              ),
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
