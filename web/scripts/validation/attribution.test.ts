import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

import { captureAttribution, referrerHostOf } from "@/lib/analytics/attribution"
import { scanStartSchema } from "@/types/zod"

/**
 * First-touch attribution on scans.
 *
 * Two sales had been made and nobody could say which channel produced either,
 * because the scans table recorded no origin at all. Every experiment —
 * Reddit Ads, a Facebook post that drove 176 scans, organic search, a few
 * hundred programmatic pages — arrived as the same anonymous row.
 *
 * Two properties are worth protecting here. The referrer must be reduced to a
 * host, because a full referring URL carries search terms and private page
 * paths that nothing downstream needs. And capture must never throw: a scan
 * failing because sessionStorage was unavailable in a private window would
 * trade a working product for a metric.
 */

describe("referrerHostOf — the privacy boundary", () => {
	it("keeps the host and discards the path and query", () => {
		// The query string here is someone's search terms.
		expect(
			referrerHostOf("https://www.google.com/search?q=my+private+thing", "getqalaunch.com"),
		).toBe("google.com")
	})

	it("strips www so one source is not counted as two", () => {
		expect(referrerHostOf("https://www.reddit.com/r/x", "getqalaunch.com")).toBe("reddit.com")
	})

	it("treats an internal link as direct, not as a source", () => {
		expect(referrerHostOf("https://getqalaunch.com/pricing", "getqalaunch.com")).toBeUndefined()
		expect(
			referrerHostOf("https://www.getqalaunch.com/php/8.3.8", "getqalaunch.com"),
		).toBeUndefined()
	})

	it("returns undefined for no referrer or a malformed one", () => {
		expect(referrerHostOf("", "getqalaunch.com")).toBeUndefined()
		expect(referrerHostOf("not a url", "getqalaunch.com")).toBeUndefined()
	})
})

describe("captureAttribution", () => {
	const store = new Map<string, string>()

	function stubWindow(search: string, referrer: string, storageWorks = true) {
		store.clear()
		vi.stubGlobal("window", {
			location: { search, hostname: "getqalaunch.com", pathname: "/php-version-checker" },
			sessionStorage: {
				getItem: (k: string) => {
					if (!storageWorks) throw new Error("blocked")
					return store.get(k) ?? null
				},
				setItem: (k: string, v: string) => {
					if (!storageWorks) throw new Error("blocked")
					store.set(k, v)
				},
			},
		})
		vi.stubGlobal("document", { referrer })
	}

	beforeEach(() => {
		store.clear()
	})
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it("captures the UTM parameters a campaign link carries", () => {
		stubWindow("?utm_source=reddit&utm_medium=cpc&utm_campaign=smallbiz_test1", "")
		const a = captureAttribution()
		expect(a.utmSource).toBe("reddit")
		expect(a.utmMedium).toBe("cpc")
		expect(a.utmCampaign).toBe("smallbiz_test1")
	})

	it("records the landing page, so a programmatic page can be credited", () => {
		stubWindow("", "https://www.google.com/")
		expect(captureAttribution().landingPath).toBe("/php-version-checker")
	})

	it("falls back to the referring host when there is no UTM", () => {
		stubWindow("", "https://www.google.com/search?q=php+version+checker")
		const a = captureAttribution()
		expect(a.utmSource).toBeUndefined()
		expect(a.referrerHost).toBe("google.com")
	})

	it("records direct traffic as genuinely empty rather than guessing", () => {
		stubWindow("", "")
		const a = captureAttribution()
		expect(a.utmSource).toBeUndefined()
		expect(a.referrerHost).toBeUndefined()
		expect(a.landingPath).toBe("/php-version-checker")
	})

	it("holds the FIRST touch for the session, not the most recent", () => {
		stubWindow("?utm_source=reddit", "")
		expect(captureAttribution().utmSource).toBe("reddit")

		// Same session, later page, different query string. The original stands.
		vi.stubGlobal("window", {
			location: { search: "?utm_source=newsletter", hostname: "getqalaunch.com", pathname: "/pricing" },
			sessionStorage: {
				getItem: (k: string) => store.get(k) ?? null,
				setItem: (k: string, v: string) => void store.set(k, v),
			},
		})
		expect(captureAttribution().utmSource).toBe("reddit")
	})

	it("never throws when storage is blocked, as in a private window", () => {
		stubWindow("?utm_source=reddit", "", false)
		expect(() => captureAttribution()).not.toThrow()
		// Still reports what it could read, it just cannot persist it.
		expect(captureAttribution().utmSource).toBe("reddit")
	})

	it("returns empty during server rendering rather than touching window", () => {
		vi.stubGlobal("window", undefined)
		expect(captureAttribution()).toEqual({})
	})

	it("caps every value, because these reach a database and an email", () => {
		stubWindow(`?utm_source=${"x".repeat(500)}`, "")
		expect(captureAttribution().utmSource!.length).toBeLessThanOrEqual(120)
	})
})

describe("scanStartSchema accepts attribution without ever requiring it", () => {
	const base = { url: "https://example.com", package: "free" as const }

	it("accepts a scan with no attribution at all", () => {
		expect(scanStartSchema.safeParse(base).success).toBe(true)
	})

	it("accepts a fully attributed scan", () => {
		expect(
			scanStartSchema.safeParse({
				...base,
				attribution: {
					utmSource: "reddit",
					utmMedium: "cpc",
					utmCampaign: "smallbiz_test1",
					referrerHost: "reddit.com",
					landingPath: "/php-version-checker",
				},
			}).success,
		).toBe(true)
	})

	it("rejects a newline smuggled through an attribution field", () => {
		expect(
			scanStartSchema.safeParse({
				...base,
				attribution: { utmSource: "reddit\r\nBcc: x@y.com" },
			}).success,
		).toBe(false)
	})
})
