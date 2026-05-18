import type { NextConfig } from "next";

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
};

export default nextConfig;
