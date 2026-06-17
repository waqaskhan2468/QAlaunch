"use client"

import { ArrowRight } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { motion } from "motion/react"

/**
 * Full-width conversion CTA band. Dark brand gradient with a subtle
 * dot-grid overlay, soft drifting orb, and a spring-press button.
 */
export function CtaBand() {
  const pathname = usePathname()
  const router = useRouter()

  const focusAuditInput = () => {
    const input = document.getElementById("audit-input") as HTMLInputElement | null
    if (!input) return false

    input.scrollIntoView({ behavior: "smooth", block: "center" })
    window.setTimeout(() => {
      input.focus({ preventScroll: true })
    }, 250)

    return true
  }

  const goToResult = () => {
    if (pathname === "/" && focusAuditInput()) return
    router.push("/#audit-input")
  }

  return (
    <section className="relative overflow-hidden bg-linear-to-br from-brand-dark to-brand px-10 py-20 text-center md:px-12 md:py-24">
      <div className="qa-cta-grid pointer-events-none absolute inset-0" />
      {/* Soft drifting accent orb */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(34,197,94,0.28)_0%,transparent_65%)]"
        animate={{ scale: [1, 1.15, 1], opacity: [0.55, 0.8, 0.55] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="relative z-10 mx-auto max-w-3xl"
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <h2 className="font-heading text-[clamp(1.875rem,4vw,2.875rem)] font-black leading-tight tracking-tight text-balance text-white">
          Stop guessing what&apos;s wrong
          <br className="hidden md:block" /> with your website.
        </h2>
        <p className="mx-auto mt-4 max-w-l  text-base leading-relaxed text-white/70 sm:text-lg">
          Free audit in 120 seconds. No signup needed. Full expert report from
          just $9.
        </p>
        <motion.button
          type="button"
          onClick={goToResult}
          whileHover={{ y: -3, scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className="mt-10 inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-accent-bright px-10 text-sm font-extrabold tracking-wide text-white shadow-glow-accent hover:bg-accent-emerald hover:shadow-glow-accent-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-bright/35 sm:h-[60px] sm:px-12 sm:text-base"
        >
          Audit My Website Free
          <motion.span
            className="inline-flex"
            animate={{ x: [0, 4, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          >
            <ArrowRight className="size-[18px]" />
          </motion.span>
        </motion.button>
        <p className="mt-4 pt-4 text-xs text-white/45 sm:text-sm">
          Trusted by founders building with Lovable, Bolt, Replit, and Shopify
        </p>
      </motion.div>
    </section>
  )
}
