import { ImageResponse } from "next/og"

/**
 * Shared 1200x630 social card used by both app/opengraph-image.tsx and
 * app/twitter-image.tsx so the two never drift apart.
 *
 * Design reuses the EXACT brand mark + colors from app/icon.tsx:
 *   - blue ring    #1847A8
 *   - dark navy    #09111F  (background + ring inner, brand dark)
 *   - electric grn #22C55E  (arrow, accent square, highlights)
 * Fonts: app/icon.tsx is pure SVG and defines no font, so there is no brand
 * font face to reuse here — we rely on ImageResponse's built-in font, which
 * renders a clean bold sans. This keeps generation network-free and reliable
 * in production (no runtime font fetch, well under the 500KB bundle cap).
 */

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt =
  "QAlaunch — AI Website Audit Tool. Find Bugs in 120 Seconds."

const BRAND_BLUE = "#1847A8"
const BRAND_NAVY = "#09111F"
const BRAND_GREEN = "#22C55E"
const MUTED = "#6B8AA3"

export function renderBrandOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BRAND_NAVY,
          padding: "72px 84px",
          borderTop: `12px solid ${BRAND_GREEN}`,
        }}
      >
        {/* Brand lockup: exact icon.tsx mark + wordmark */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <svg
            width="112"
            height="112"
            viewBox="0 0 48 48"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="24" cy="24" r="22" fill={BRAND_BLUE} />
            <circle cx="24" cy="24" r="15.5" fill={BRAND_NAVY} />
            <rect x="28.5" y="30" width="6" height="4" fill={BRAND_GREEN} />
            <polygon
              points="24,10 32,20 28,20 28,28 20,28 20,20 16,20"
              fill={BRAND_GREEN}
            />
          </svg>
          <div
            style={{
              display: "flex",
              marginLeft: 28,
              fontSize: 60,
              fontWeight: 800,
              color: "#FFFFFF",
              letterSpacing: -2,
            }}
          >
            QAlaunch
          </div>
        </div>

        {/* Headline — the tagline from item 1 */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 30,
              fontWeight: 700,
              color: BRAND_GREEN,
              letterSpacing: 6,
              marginBottom: 20,
            }}
          >
            AI WEBSITE AUDIT TOOL
          </div>
          {/* Two stacked lines — avoids Satori's flaky inline spacing. */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 96,
              fontWeight: 800,
              lineHeight: 1.04,
            }}
          >
            <div style={{ display: "flex", color: "#FFFFFF" }}>Find Bugs in</div>
            <div style={{ display: "flex", color: BRAND_GREEN }}>
              120 Seconds
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 32,
              fontWeight: 700,
              color: BRAND_GREEN,
            }}
          >
            Reports from $9
          </div>
          <div style={{ display: "flex", fontSize: 32, color: MUTED }}>
            getqalaunch.com
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
