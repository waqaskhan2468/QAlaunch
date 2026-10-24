import type { NextConfig } from "next";

/**
 * Security response headers.
 *
 * Our own PHP checker reports how many of six common security headers a site
 * sends, and getqalaunch.com was sending one — the HSTS that Vercel adds by
 * itself. A page that tells strangers to check their headers should not fail
 * its own check.
 *
 * Content-Security-Policy is deliberately NOT here, and that is a considered
 * omission rather than an oversight. Paddle is loaded lazily, only once
 * someone presses Pay, so its script, connect and frame origins cannot be
 * observed without putting a real transaction through. A CSP written from
 * guesswork about those origins would break checkout, and checkout is the only
 * part of this site that makes money. It needs its own pass: drive a sandbox
 * payment, record every origin Paddle actually touches, ship report-only
 * first, then enforce.
 *
 * The four below cannot break anything here: none of them restricts an origin
 * this site loads from.
 */
const securityHeaders = [
  {
    // Stops a browser second-guessing a declared content type — e.g. deciding
    // an uploaded "image" is really a script and running it.
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Clickjacking: stops another site loading ours in a hidden frame to
    // harvest clicks. SAMEORIGIN rather than DENY so our own pages may still
    // frame each other. This governs who may frame US; it does not affect the
    // Paddle overlay, which is an iframe we open inside our own page.
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    // Send the full URL to ourselves, origin only to other sites, nothing at
    // all when downgrading to http. This is the modern default and it stops
    // scan result URLs — which contain a visitor's own domain — leaking in
    // the Referer header to third parties.
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Only features this site genuinely never uses. Payment is deliberately
    // absent from this list: Paddle may rely on the Payment Request API, and
    // disabling it to tidy up a header would be a bad trade.
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  // Server-only deps used by /api/inngest + scan pipeline — do not bundle for the browser.
  serverExternalPackages: [
    // Required: injected into the page via page.evaluate; bundling causes "module is not defined".
    "@axe-core/playwright",
    "axe-core",
    // Recommended: CDP client + native bits; used only on the server (Browserbase connect).
    "playwright-core",
    // Recommended: native image codec bindings for screenshot compression.
    "sharp",
  ],

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
