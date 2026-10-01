import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

import { trackRedditEvent } from "@/lib/analytics/reddit"

/**
 * The Reddit Pixel is production-only and carries a real advertiser ID.
 *
 * The production guard matters: firing outside production would put our own
 * local clicking into the ad account's retargeting audience and teach the
 * optimiser the wrong thing.
 *
 * A previous analytics change looked correct in tests and rendered as literal
 * `null` in the built HTML, so these assert on the actual emitted script text
 * rather than on the component merely returning something truthy.
 */

const PIXEL_ID = "a2_jrxtlfnz8kas"

async function renderPixel() {
  vi.resetModules()
  const { RedditPixel } = await import("@/components/analytics/reddit-pixel")
  return RedditPixel() as { props?: { children?: string } } | null
}

describe("RedditPixel", () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
  })
  afterEach(() => {
    process.env = env
  })

  it("renders nothing on a preview deploy", async () => {
    process.env.VERCEL_ENV = "preview"
    expect(await renderPixel()).toBeNull()
  })

  it("renders nothing in local development", async () => {
    delete process.env.VERCEL_ENV
    expect(await renderPixel()).toBeNull()
  })

  it("emits init and PageVisit with the real ID in production", async () => {
    process.env.VERCEL_ENV = "production"

    const script = await renderPixel()
    const body = script?.props?.children ?? ""

    expect(body).toContain(`rdt('init','${PIXEL_ID}')`)
    expect(body).toContain("rdt('track', 'PageVisit')")
    expect(body).toContain("redditstatic.com/ads/pixel.js")
    // The ID must be interpolated, never left as a template placeholder.
    expect(body).not.toContain("${")
  })

  it("loads the pixel exactly once, so visits are not double counted", async () => {
    process.env.VERCEL_ENV = "production"

    const body = (await renderPixel())?.props?.children ?? ""

    expect(body.match(/rdt\('init'/g)).toHaveLength(1)
    expect(body.match(/rdt\('track', 'PageVisit'\)/g)).toHaveLength(1)
  })
})

describe("trackRedditEvent", () => {
  // The suite runs in the node environment, so stand up the minimum `window`
  // the helper reaches for rather than pulling in a DOM just for this.
  beforeEach(() => {
    vi.stubGlobal("window", {} as Window & typeof globalThis)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("does nothing when the pixel never loaded", () => {
    expect(() => trackRedditEvent("Lead")).not.toThrow()
  })

  it("does nothing when there is no window at all", () => {
    vi.unstubAllGlobals()
    vi.stubGlobal("window", undefined)
    expect(() => trackRedditEvent("Lead")).not.toThrow()
  })

  it("forwards the event to rdt when the pixel is present", () => {
    const rdt = vi.fn()
    vi.stubGlobal("window", { rdt })

    trackRedditEvent("Lead")

    expect(rdt).toHaveBeenCalledWith("track", "Lead", undefined)
  })

  it("passes metadata through when given", () => {
    const rdt = vi.fn()
    vi.stubGlobal("window", { rdt })

    trackRedditEvent("Purchase", { value: 9, currency: "USD" })

    expect(rdt).toHaveBeenCalledWith("track", "Purchase", {
      value: 9,
      currency: "USD",
    })
  })

  it("swallows an error thrown by the pixel rather than breaking the scan", () => {
    vi.stubGlobal("window", {
      rdt: () => {
        throw new Error("blocked by extension")
      },
    })

    expect(() => trackRedditEvent("Lead")).not.toThrow()
  })
})
