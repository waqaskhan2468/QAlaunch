import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

import { trackRedditEvent } from "@/lib/analytics/reddit"

/**
 * The Reddit Pixel is production-only and renders nothing without an ID.
 *
 * Both guards matter for real reasons. Firing outside production would put our
 * own local clicking into the ad account's retargeting audience and teach the
 * optimiser the wrong thing. Rendering with an empty ID would emit an
 * `rdt('init','')` call that throws inside Reddit's own script.
 *
 * A previous analytics change looked correct in tests and rendered as literal
 * `null` in the built HTML, so these assert on the actual emitted script text
 * rather than on the component merely returning something truthy.
 */

const PIXEL_ID = "a2_test123abc"

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

  it("renders nothing outside production", async () => {
    process.env.VERCEL_ENV = "preview"
    process.env.NEXT_PUBLIC_REDDIT_PIXEL_ID = PIXEL_ID
    expect(await renderPixel()).toBeNull()
  })

  it("renders nothing in production when the ID is unset", async () => {
    process.env.VERCEL_ENV = "production"
    delete process.env.NEXT_PUBLIC_REDDIT_PIXEL_ID
    expect(await renderPixel()).toBeNull()
  })

  it("renders nothing in production when the ID is an empty string", async () => {
    process.env.VERCEL_ENV = "production"
    process.env.NEXT_PUBLIC_REDDIT_PIXEL_ID = ""
    expect(await renderPixel()).toBeNull()
  })

  it("emits init and PageVisit with the real ID in production", async () => {
    process.env.VERCEL_ENV = "production"
    process.env.NEXT_PUBLIC_REDDIT_PIXEL_ID = PIXEL_ID

    const script = await renderPixel()
    const body = script?.props?.children ?? ""

    expect(body).toContain(`rdt('init','${PIXEL_ID}')`)
    expect(body).toContain("rdt('track', 'PageVisit')")
    expect(body).toContain("redditstatic.com/ads/pixel.js")
    // The ID must be interpolated, never left as a template placeholder.
    expect(body).not.toContain("${")
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
