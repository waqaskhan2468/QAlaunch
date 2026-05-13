"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { usePathname } from "next/navigation"

type PageTransitionProps = {
  children: React.ReactNode
}

/**
 * Cross-fade + slight vertical shift on client-side navigations.
 * Wraps the root layout `children` so every App Router page swap animates.
 *
 * `AnimatePresence` + `key={pathname}` lets the outgoing page run `exit`
 * before the incoming page mounts (mode="wait").
 *
 * @see https://motion.dev/docs/react-animate-presence
 */
export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname()
  const reduceMotion = useReducedMotion()

  if (reduceMotion) {
    return <>{children}</>
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        className="w-full min-h-0"
        initial={{ opacity: 0, y: 12 }}
        animate={{
          opacity: 1,
          y: 0,
          transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
        }}
        exit={{
          opacity: 0,
          y: -8,
          transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
