import { cn } from "@/lib/utils"

/**
 * Signature angular "flag" device — a green parallelogram used sitewide as the
 * recurring accent: badge/eyebrow replacement (instead of rounded pills), the
 * "Most Popular" pricing marker, and section-divider accents.
 *
 * The outer element carries the skew + fill; the inner element counter-skews so
 * the label stays upright. Sharp corners only — no border-radius.
 */
export function Flag({
  children,
  className,
  tone = "green",
}: {
  children: React.ReactNode
  className?: string
  tone?: "green" | "navy" | "outline"
}) {
  const fill =
    tone === "navy"
      ? "bg-slate-deep text-white"
      : tone === "outline"
        ? "border-2 border-accent-bright bg-transparent text-accent-emerald"
        : "bg-accent-bright text-white"

  return (
    <span className={cn("inline-block -skew-x-[12deg] align-middle", fill, className)}>
      <span className="inline-flex skew-x-[12deg] items-center gap-1 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider leading-none">
        {children}
      </span>
    </span>
  )
}
