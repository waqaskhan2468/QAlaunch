import Script from "next/script"

/**
 * Reddit advertiser ID, of the form `a2_abc123def45`.
 *
 * Read from the environment rather than hardcoded (unlike the GA4 ID) so the
 * pixel can be switched on from Vercel without a deploy of its own. Absent or
 * empty, nothing renders at all — a missing ID is a no-op, never a broken tag.
 *
 * NEXT_PUBLIC_* values are inlined at build time, so adding the variable in
 * Vercel requires a redeploy before the pixel appears in the HTML.
 */
const REDDIT_PIXEL_ID = process.env.NEXT_PUBLIC_REDDIT_PIXEL_ID

/**
 * Reddit Pixel (rdt.js).
 *
 * Installed for the paid campaign. The Traffic objective does not need it, but
 * two later things do, and both need history that can only be collected from
 * now onwards: retargeting the people who visited but did not scan, and a
 * Conversions-objective campaign, which cannot optimise without prior events.
 *
 * Production-only, matching GoogleAnalytics — preview builds on `staging` and
 * local dev report a non-production VERCEL_ENV, so our own clicking around
 * never pollutes the ad account's audience data.
 *
 * `afterInteractive` (the Next default) loads it after hydration rather than
 * blocking first paint. Unlike GA4, Reddit's pixel does not hook the History
 * API, so PageVisit fires once per full page load. That is enough: the visitor
 * is cookied on arrival, which is all a retargeting audience needs.
 */
export function RedditPixel() {
  if (process.env.VERCEL_ENV !== "production") return null
  if (!REDDIT_PIXEL_ID) return null

  return (
    <Script id="reddit-pixel" strategy="afterInteractive">
      {`
        !function(w,d){if(!w.rdt){var p=w.rdt=function(){p.sendEvent?p.sendEvent.apply(p,arguments):p.callQueue.push(arguments)};p.callQueue=[];var t=d.createElement("script");t.src="https://www.redditstatic.com/ads/pixel.js",t.async=!0;var s=d.getElementsByTagName("script")[0];s.parentNode.insertBefore(t,s)}}(window,document);
        rdt('init','${REDDIT_PIXEL_ID}');
        rdt('track', 'PageVisit');
      `}
    </Script>
  )
}
