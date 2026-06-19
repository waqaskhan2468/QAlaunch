import { cn } from "@/lib/utils"
import { Flag } from "@/components/home/flag"

type SectionHeaderProps = {
  eyebrow: string
  title: React.ReactNode
  description?: string
  align?: "left" | "center"
  className?: string
  /** If true, render with light-on-dark colors (for dark sections). */
  tone?: "light" | "dark"
}

/**
 * Reusable section title block. Keeps vertical rhythm, eyebrow styling,
 * and optional description consistent across all marketing sections.
 */
export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
  className,
  tone = "dark",
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        align === "center" && "mx-auto text-center",
        align === "center" && "max-w-2xl",
        className,
      )}
    >
      <div className="mb-4">
        <Flag>{eyebrow}</Flag>
      </div>
      <h2
        className={cn(
          "font-heading text-[clamp(1.75rem,3.6vw,2.75rem)] font-black leading-tight tracking-[-0.03em] text-balance",
          tone === "dark" ? "text-ink" : "text-white",
        )}
      >
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            "mt-4 text-base leading-relaxed text-pretty sm:text-lg",
            align === "center" ? "mx-auto" : "",
            "max-w-xl",
            tone === "dark" ? "text-body" : "text-white/60",
          )}
        >
          {description}
        </p>
      )}
    </div>
  )
}
