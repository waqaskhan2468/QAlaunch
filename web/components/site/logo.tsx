import { cn } from "@/lib/utils"

type LogoProps = {
  size?: number
  className?: string
  showWordmark?: boolean
  /** `light` → white wordmark on dark bg, `dark` → ink wordmark on light bg */
  tone?: "light" | "dark"
}

/**
 * QAlaunch brand mark — a rising rocket/arrow tucked inside a circular
 * monitor/screen, built entirely from SVG primitives (no raster logos).
 */
export function Logo({
  size = 32,
  className,
  showWordmark = true,
  tone = "light",
}: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 34 34"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="17" cy="16" r="14" fill="#1847A8" />
        <circle cx="17" cy="16" r="9.5" fill="rgba(255,255,255,0.08)" />
        <rect x="8" y="23" width="18" height="7" fill="rgba(255,255,255,0.08)" />
        <polygon
          points="17,8 24.5,17 20,17 20,23 14,23 14,17 9.5,17"
          fill="#22C55E"
        />
      </svg>
      {showWordmark && (
        <span
          className={cn(
            "font-heading text-[18px] font-black tracking-tight",
            tone === "light" ? "text-white" : "text-ink",
          )}
        >
          QAlaunch
        </span>
      )}
    </div>
  )
}
