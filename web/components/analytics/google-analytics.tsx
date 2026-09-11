import Script from "next/script"

// GA4 measurement ID for getqalaunch.com.
const GA_MEASUREMENT_ID = "G-FBRDELS474"

/**
 * Google Analytics 4 (gtag.js).
 *
 * Only renders on the real production deployment. Vercel preview builds (the
 * `staging` branch) and local dev both report a non-production `VERCEL_ENV`,
 * so our own testing never lands in the same property as real visitor data.
 *
 * `afterInteractive` is the Next-recommended strategy for analytics: the tag
 * loads right after hydration rather than blocking first paint. GA4's enhanced
 * measurement picks up client-side route changes via History API events, so
 * App Router navigations are counted without any manual pageview calls —
 * adding those here would double-count every page.
 */
export function GoogleAnalytics() {
  if (process.env.VERCEL_ENV !== "production") return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      {/* Inline scripts require an `id` so Next can track and optimize them. */}
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());

          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
    </>
  )
}
