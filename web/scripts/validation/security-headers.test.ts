import { describe, it, expect } from "vitest"

import nextConfig from "../../next.config"

/**
 * Security response headers for getqalaunch.com.
 *
 * Our own PHP checker reports how many of six common security headers a site
 * sends, and this site was sending one — the HSTS Vercel adds by itself. A
 * page that tells strangers to check their headers has to pass its own check.
 *
 * These tests also pin the two decisions that are easy to "tidy up" later and
 * expensive to get wrong: no blocking CSP until Paddle's origins are measured,
 * and `payment` left out of Permissions-Policy.
 */

async function headerMap() {
	const groups = await nextConfig.headers!()
	const all = groups.flatMap((g) => g.headers)
	return Object.fromEntries(all.map((h) => [h.key.toLowerCase(), h.value]))
}

describe("security headers", () => {
	it("applies to every route, not just the homepage", async () => {
		const groups = await nextConfig.headers!()
		expect(groups).toHaveLength(1)
		expect(groups[0].source).toBe("/:path*")
	})

	it("sends the four headers that carry no breakage risk", async () => {
		const h = await headerMap()
		expect(h["x-content-type-options"]).toBe("nosniff")
		expect(h["x-frame-options"]).toBe("SAMEORIGIN")
		expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin")
		expect(h["permissions-policy"]).toBeTruthy()
	})

	it("does NOT disable payment in Permissions-Policy", async () => {
		// Paddle may rely on the Payment Request API. Disabling it to make a
		// header look tidier would risk the only part of this site that earns.
		const h = await headerMap()
		expect(h["permissions-policy"]).not.toMatch(/payment\s*=/)
	})

	it("disables only features this site never uses", async () => {
		const h = await headerMap()
		for (const feature of ["camera", "microphone", "geolocation"]) {
			expect(h["permissions-policy"]).toContain(`${feature}=()`)
		}
	})

	it("ships NO blocking CSP until Paddle's origins have been measured", async () => {
		// Deliberate. Paddle loads lazily, only once Pay is pressed, so its
		// script/connect/frame origins cannot be observed without putting a real
		// transaction through. A CSP guessed from docs would break checkout.
		// When this changes: drive a sandbox payment, record every origin,
		// ship Content-Security-Policy-Report-Only first, then enforce.
		const h = await headerMap()
		expect(h["content-security-policy"]).toBeUndefined()
	})

	it("does not set HSTS itself, which Vercel already provides", async () => {
		// Two Strict-Transport-Security headers is a misconfiguration, and the
		// platform's own is correct.
		const h = await headerMap()
		expect(h["strict-transport-security"]).toBeUndefined()
	})
})
