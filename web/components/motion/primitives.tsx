"use client"

import { motion, type HTMLMotionProps, type Variants } from "motion/react"
import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ */
/*  Shared variants                                                   */
/* ------------------------------------------------------------------ */

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
}

export const fadeUpSoft: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
}

export const stagger = (delayChildren = 0, staggerChildren = 0.08): Variants => ({
  hidden: {},
  visible: {
    transition: { delayChildren, staggerChildren },
  },
})

/* ------------------------------------------------------------------ */
/*  Reveal wrapper (scroll-triggered or immediate)                     */
/* ------------------------------------------------------------------ */

type RevealProps = HTMLMotionProps<"div"> & {
  variants?: Variants
  delay?: number
  onView?: boolean
  as?: "div" | "section" | "article" | "header"
}

export function Reveal({
  variants = fadeUp,
  delay = 0,
  onView = true,
  className,
  children,
  ...rest
}: RevealProps) {
  const props = onView
    ? {
        initial: "hidden",
        whileInView: "visible",
        viewport: { once: true, margin: "-60px" },
      }
    : { initial: "hidden", animate: "visible" }

  return (
    <motion.div
      variants={variants}
      transition={{ delay }}
      className={cn(className)}
      {...props}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Animated count-up number                                           */
/* ------------------------------------------------------------------ */

export function CountUp({
  to,
  from = 0,
  duration = 1400,
  suffix = "",
  prefix = "",
  className,
}: {
  to: number
  from?: number
  duration?: number
  suffix?: string
  prefix?: string
  className?: string
}) {
  const [value, setValue] = useState(from)
  const ref = useRef<HTMLSpanElement | null>(null)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || started.current) return
          started.current = true
          const start = performance.now()
          const tick = (now: number) => {
            const t = Math.min(1, (now - start) / duration)
            const eased = 1 - Math.pow(1 - t, 3)
            setValue(Math.round(from + (to - from) * eased))
            if (t < 1) requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        })
      },
      { threshold: 0.3 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [to, from, duration])

  return (
    <span ref={ref} className={className}>
      {prefix}
      {value}
      {suffix}
    </span>
  )
}
