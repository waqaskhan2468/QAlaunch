import { ImageResponse } from "next/og"

/**
 * Shared 1200x630 social card used by both app/opengraph-image.tsx and
 * app/twitter-image.tsx so the two never drift apart.
 *
 * DESIGNED AROUND A CENTRE SAFE ZONE.
 *
 * 1200x630 (1.91:1) is the spec every platform asks for, but almost none of
 * them display it whole. Facebook and LinkedIn show the full frame; X crops
 * top and bottom to 2:1; Reddit's feed card and most chat apps crop a near
 * SQUARE out of the middle. The previous version put every element in the left
 * 55% with an empty right half, so Reddit's centre crop landed mid-sentence
 * and showed "...nd Bugs in / 0 Seconds".
 *
 * The fix is to treat the central 630x630 square as the only region guaranteed
 * to survive, centre everything inside it, and let the outer thirds carry
 * background only. SAFE_WIDTH below is deliberately narrower than that square
 * so even an aggressive crop keeps the words intact.
 *
 * Brand mark and colours match app/icon.tsx exactly:
 *   blue ring #1847A8 · dark navy #09111F · electric green #22C55E
 * No webfont is loaded: ImageResponse's built-in sans keeps generation
 * network-free and well under the bundle cap.
 */

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt =
  "QAlaunch — find what's broken on your website in 120 seconds."

const BRAND_BLUE = "#1847A8"
const BRAND_NAVY = "#09111F"
const BRAND_GREEN = "#22C55E"
const MUTED = "#7E93A8"

/**
 * Widest any text may be. The centre square is 630px; holding content to 600
 * leaves a margin on both sides so a square crop never clips a letter.
 */
const SAFE_WIDTH = 600

export function renderBrandOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND_NAVY,
          borderTop: `10px solid ${BRAND_GREEN}`,
        }}
      >
        {/* Everything lives in the centre column, inside the safe zone. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: SAFE_WIDTH,
            textAlign: "center",
          }}
        >
          {/* Brand lockup */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 30,
            }}
          >
            <svg
              width="72"
              height="72"
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
                marginLeft: 18,
                fontSize: 46,
                fontWeight: 800,
                color: "#FFFFFF",
                letterSpacing: -1.5,
              }}
            >
              QAlaunch
            </div>
          </div>

          {/* Headline. Each line is its own flex row with a single colour:
              Satori renders inline spans with uneven word spacing, which is
              what produced the visible gap in "broken  on your". Two lines
              also read better than three and stay well inside SAFE_WIDTH. */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              fontSize: 60,
              fontWeight: 800,
              lineHeight: 1.14,
              letterSpacing: -2,
            }}
          >
            <div style={{ display: "flex", color: "#FFFFFF" }}>
              Find what&apos;s broken
            </div>
            <div style={{ display: "flex", color: BRAND_GREEN }}>
              on your website
            </div>
          </div>

          {/* Supporting line */}
          <div
            style={{
              display: "flex",
              marginTop: 26,
              fontSize: 30,
              fontWeight: 600,
              color: MUTED,
            }}
          >
            Free scan · no signup · 2 minutes
          </div>

          {/* Domain, kept inside the safe zone rather than pinned to a corner. */}
          <div
            style={{
              display: "flex",
              marginTop: 14,
              fontSize: 28,
              fontWeight: 700,
              color: BRAND_GREEN,
            }}
          >
            getqalaunch.com
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
