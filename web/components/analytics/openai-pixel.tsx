import Script from "next/script"

// OpenAI measurement pixel for the ChatGPT Ads account. Hardcoded like the GA4
// and Reddit IDs: it is served to every visitor in the page source, so it is
// not a secret, and an environment variable is one more thing that can be
// missing on a new deploy target without anyone noticing.
const OPENAI_PIXEL_ID = "244x9x6TNSFrbJmwcm9PzM"

/**
 * Logs SDK activity to the browser console. OpenAI recommends it while setting
 * up, and it is how the pixel gets verified in Ads Manager.
 *
 * Turn this off once the pixel is confirmed: it prints on every page load for
 * every visitor, and we have just finished clearing this site's console of
 * noise — our own scanner reports console errors as a finding.
 */
const DEBUG = true

/**
 * OpenAI Measurement Pixel (oaiq).
 *
 * Attributes website events back to ChatGPT ads. Unlike GA4 and unlike Reddit,
 * this SDK measures nothing on its own: per OpenAI's docs the base snippet
 * does not record page views, so `page_viewed` has to be sent explicitly or
 * the pixel sits there collecting nothing at all.
 *
 * Production-only, matching GoogleAnalytics and RedditPixel — preview builds
 * on `staging` and local dev report a non-production VERCEL_ENV, so our own
 * clicking around never lands in the ad account's conversion data and never
 * teaches the optimiser the wrong thing.
 *
 * OpenAI asks for this near the top of <head>, which would mean
 * `beforeInteractive`. It is deliberately `afterInteractive` instead, the same
 * as the other two tags: beforeInteractive downloads ahead of any Next.js code
 * and delays interactivity on a site whose whole pitch is that it finds what
 * slows a page down. The cost is a few hundred milliseconds of attribution
 * latency on a visitor who has just clicked through from an ad and is not
 * about to leave in that window. Say the word if you would rather have it the
 * other way.
 */
export function OpenAiPixel() {
  if (process.env.VERCEL_ENV !== "production") return null

  return (
    <Script id="openai-pixel" strategy="afterInteractive">
      {`
        !function(w,d,s,u){if(w.oaiq)return;var q=function(){q.q.push(arguments)};q.q=[];w.oaiq=q;var j=d.createElement(s);j.async=1;j.src=u;var f=d.getElementsByTagName(s)[0];f.parentNode.insertBefore(j,f)}(window,document,"script","https://bzrcdn.openai.com/sdk/oaiq.min.js");
        oaiq("init",{pixelId:"${OPENAI_PIXEL_ID}",debug:${DEBUG}});
        oaiq("measure","page_viewed",{type:"contents"});
      `}
    </Script>
  )
}
