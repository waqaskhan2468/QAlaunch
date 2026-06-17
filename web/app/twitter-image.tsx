import { renderBrandOgImage, size, alt, contentType } from "@/lib/og-image"

// Next.js file convention: auto-injects twitter:image meta tags. Reuses the
// same 1200x630 brand card as opengraph-image so the two stay identical.
export { size, alt, contentType }

export default function Image() {
  return renderBrandOgImage()
}
