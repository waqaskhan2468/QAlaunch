import Script from "next/script"

// Reddit pixel ID for the QA Launch ad account. Hardcoded like the GA4 ID:
// (This is the second ad account. The first one's Reddit profile was suspended,
// which locked every campaign under it, so the account was rebuilt from
// scratch under a different profile and issued a new pixel.)
// it is served to every visitor in the page source, so it is not a secret, and
// keeping it here means the tag cannot silently go missing because an
// environment variable was never set on a new deploy target.
const REDDIT_PIXEL_ID = "a2_jrxtlfnz8kas"

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
