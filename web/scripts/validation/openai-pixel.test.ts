import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

import { trackOpenAiEvent } from "@/lib/analytics/openai"

/**
 * The OpenAI measurement pixel for ChatGPT Ads.
 *
 * Two things about this SDK are easy to get wrong and silent when you do:
 *
 * 1. It measures nothing on its own. OpenAI's docs are explicit that the base
 *    snippet does not record page views, so a pixel that looks installed can
 *    sit there reporting zero indefinitely.
 * 2. Each event name requires a specific `type` in its data, and the pairings
 *    are not guessable — lead_created takes "customer_action" while almost
 *    everything else takes "contents". A mismatch is rejected.
 */

const PIXEL_ID = "244x9x6TNSFrbJmwcm9PzM"

async function renderPixel() {
	vi.resetModules()
	const { OpenAiPixel } = await import("@/components/analytics/openai-pixel")
	return OpenAiPixel() as { props?: { children?: string } } | null
}

describe("OpenAiPixel", () => {
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

	it("initialises with the real pixel id in production", async () => {
		process.env.VERCEL_ENV = "production"
		const body = (await renderPixel())?.props?.children ?? ""

		expect(body).toContain(`pixelId:"${PIXEL_ID}"`)
		expect(body).toContain("bzrcdn.openai.com/sdk/oaiq.min.js")
		// Interpolated, never left as a template placeholder — a bug this repo
		// has shipped before, in schema markup that rendered as literal null.
		expect(body).not.toContain("${")
	})

	it("sends page_viewed, which the SDK does NOT do by itself", async () => {
		process.env.VERCEL_ENV = "production"
		const body = (await renderPixel())?.props?.children ?? ""

		expect(body).toContain('oaiq("measure","page_viewed",{type:"contents"})')
	})

	it("loads and initialises exactly once, so visits are not double counted", async () => {
		process.env.VERCEL_ENV = "production"
		const body = (await renderPixel())?.props?.children ?? ""

		expect(body.match(/oaiq\("init"/g)).toHaveLength(1)
		expect(body.match(/oaiq\.min\.js/g)).toHaveLength(1)
	})
})

describe("trackOpenAiEvent", () => {
	beforeEach(() => {
		vi.stubGlobal("window", {} as Window & typeof globalThis)
	})
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it("does nothing when the pixel never loaded", () => {
		expect(() => trackOpenAiEvent("lead_created")).not.toThrow()
	})

	it("pairs lead_created with customer_action, not contents", () => {
		const oaiq = vi.fn()
		vi.stubGlobal("window", { oaiq })

		trackOpenAiEvent("lead_created")

		expect(oaiq).toHaveBeenCalledWith("measure", "lead_created", {
			type: "customer_action",
		})
	})

	it("pairs checkout_started with contents", () => {
		const oaiq = vi.fn()
		vi.stubGlobal("window", { oaiq })

		trackOpenAiEvent("checkout_started")

		expect(oaiq).toHaveBeenCalledWith("measure", "checkout_started", {
			type: "contents",
		})
	})

	it("merges extra fields, so order_created can carry amount and currency", () => {
		const oaiq = vi.fn()
		vi.stubGlobal("window", { oaiq })

		trackOpenAiEvent("order_created", { amount: 9, currency: "USD" })

		expect(oaiq).toHaveBeenCalledWith("measure", "order_created", {
			type: "contents",
			amount: 9,
			currency: "USD",
		})
	})

	it("swallows an error thrown by the SDK rather than breaking the scan", () => {
		vi.stubGlobal("window", {
			oaiq: () => {
				throw new Error("blocked by extension")
			},
		})

		expect(() => trackOpenAiEvent("lead_created")).not.toThrow()
	})
})
