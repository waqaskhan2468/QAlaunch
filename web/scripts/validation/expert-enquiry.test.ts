import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { expertEnquirySchema } from "@/types/zod"

/**
 * The "hire an expert" enquiry from the PHP checker results.
 *
 * Two things here are easy to break silently and expensive when they go:
 *
 * 1. The recipient. A wrong address does not bounce visibly to anyone
 *    watching — the leads simply stop arriving and nobody notices for weeks.
 *    This was nearly shipped pointing at a mistyped domain that happened to be
 *    real and accept mail, which is the version of this mistake that never
 *    announces itself. Hence an explicit assertion on the address.
 * 2. The hardening. This route shares the internet with the other two forms,
 *    so it needs the same rate limit, honeypot and header escaping. A new form
 *    added later without them reopens a hole that was already closed once.
 */

const routeSrc = readFileSync(
	join(process.cwd(), "app/api/expert-enquiry/route.ts"),
	"utf8",
)

describe("recipient", () => {
	it("sends to the same inbox as every other form on the site", () => {
		expect(routeSrc).toMatch(/['"]contact@getqalaunch\.com['"]/)
		// Guards the near-miss: a mistyped domain that is real and accepts mail
		// swallows leads without ever bouncing.
		expect(routeSrc).not.toMatch(/qanalyx/i)
	})

	it("sets reply-to to the enquirer, so replying reaches them", () => {
		expect(routeSrc).toMatch(/replyTo:\s*email/)
	})
})

describe("hardening, matching the other two forms", () => {
	it("rate limits before reading the body", () => {
		const limitAt = routeSrc.indexOf("assertFormSubmitAllowed")
		const parseAt = routeSrc.indexOf("req.json()")
		expect(limitAt).toBeGreaterThan(-1)
		expect(limitAt).toBeLessThan(parseAt)
	})

	it("discards a honeypot submission with a 200, telling a bot nothing", () => {
		expect(routeSrc).toMatch(/parsed\.data\.company/)
		expect(routeSrc).toMatch(/expert_enquiry_honeypot/)
	})

	it("escapes values into the HTML body and scrubs the subject", () => {
		expect(routeSrc).toMatch(/escapeHtml\(/)
		expect(routeSrc).toMatch(/subject:\s*headerSafe\(/)
	})
})

describe("schema", () => {
	const valid = {
		name: "Jane Doe",
		email: "jane@example.com",
		websiteUrl: "https://example.com",
	}

	it("accepts the three fields a person actually fills in", () => {
		expect(expertEnquirySchema.safeParse(valid).success).toBe(true)
	})

	it("requires a name, an email and a website", () => {
		for (const missing of ["name", "email", "websiteUrl"] as const) {
			const body: Record<string, unknown> = { ...valid }
			delete body[missing]
			expect(
				expertEnquirySchema.safeParse(body).success,
				`${missing} should be required`,
			).toBe(false)
		}
	})

	it("rejects a newline in the website, which reaches the Subject", () => {
		expect(
			expertEnquirySchema.safeParse({
				...valid,
				websiteUrl: "example.com\r\nBcc: attacker@evil.com",
			}).success,
		).toBe(false)
	})

	it("rejects a newline in the name", () => {
		expect(
			expertEnquirySchema.safeParse({ ...valid, name: "Jane\nBcc: x@y.com" }).success,
		).toBe(false)
	})

	it("keeps the note optional, because a fourth required field costs replies", () => {
		expect(expertEnquirySchema.safeParse(valid).success).toBe(true)
		expect(
			expertEnquirySchema.safeParse({ ...valid, need: "update PHP, no idea how" }).success,
		).toBe(true)
	})

	it("carries the detected PHP and host through without the person typing them", () => {
		const parsed = expertEnquirySchema.safeParse({
			...valid,
			detectedPhp: "8.3.8",
			detectedHost: "Bluehost",
		})
		expect(parsed.success).toBe(true)
		if (parsed.success) {
			expect(parsed.data.detectedPhp).toBe("8.3.8")
			expect(parsed.data.detectedHost).toBe("Bluehost")
		}
	})

	it("accepts the honeypot field present and empty", () => {
		expect(expertEnquirySchema.safeParse({ ...valid, company: "" }).success).toBe(true)
	})
})

describe("the alert does not overstate what we found", () => {
	it("tells the reader a PHP banner is not a diagnosis", () => {
		// The person replying should not open with "you are vulnerable" either.
		expect(routeSrc).toMatch(/hosts often patch without changing it/i)
		expect(routeSrc).not.toMatch(/is vulnerable/i)
	})
})
