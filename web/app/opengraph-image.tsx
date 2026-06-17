import { renderBrandOgImage, size, alt, contentType } from "@/lib/og-image"

// Next.js file convention: auto-injects og:image meta tags for the site.
export { size, alt, contentType }

export default function Image() {
  return renderBrandOgImage()
}
