const items = [
  "Usability Testing",
  "UI Bug Detection",
  "Functionality Checks",
  "Mobile Responsiveness",
  "Performance Analysis",
  "SEO Fundamentals",
  "Broken Link Detection",
  "Accessibility Checks",
  "Trust Signal Analysis",
  "Conversion Optimisation",
]

/**
 * Infinite marquee strip directly below the hero. Items are duplicated so
 * the `translateX(-50%)` keyframe produces a seamless loop.
 */
export function Ticker() {
  const loop = [...items, ...items]

  return (
    <div className="overflow-hidden border-y border-white/5 bg-ink py-4">
      <div className="qa-ticker flex w-max gap-12">
        {loop.map((label, i) => (
          <div
            key={`${label}-${i}`}
            className="flex shrink-0 items-center gap-2 whitespace-nowrap text-[13px] font-semibold text-white/45"
          >
            <span className="size-1.5 shrink-0 rounded-full bg-accent-bright" />
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}
