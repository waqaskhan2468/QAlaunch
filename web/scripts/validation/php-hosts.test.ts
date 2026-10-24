import { describe, it, expect } from "vitest"

import {
	HOSTS,
	HOSTS_REVIEWED,
	hostBySlug,
	hostForPlatform,
	statusLabel,
} from "@/lib/php-check/hosts"

/**
 * Per-host PHP patch status pages.
 *
 * These publish dated claims about named companies' security posture. That is
 * a more serious thing to get wrong than a version number: at best it destroys
 * the trust the page exists to earn, at worst it is defamatory.
 *
 * So the rules enforced here are not style preferences. A status other than
 * "not_found" must carry a link to the host's OWN page and a verbatim quote
 * from it, because those are what let a reader check the claim rather than
 * take our word for it. "No public statement found" is a legitimate, publishable
 * answer and most rows are expected to carry it.
 */

describe("host data integrity", () => {
	it("gives every host a unique slug and a name", () => {
		const slugs = HOSTS.map((h) => h.slug)
		expect(new Set(slugs).size).toBe(slugs.length)
		for (const h of HOSTS) {
			expect(h.slug, `${h.name} has a bad slug`).toMatch(/^[a-z0-9-]+$/)
			expect(h.name.length).toBeGreaterThan(1)
		}
	})

	it("requires a source URL for any claim other than not_found", () => {
		for (const h of HOSTS) {
			if (h.status === "not_found") continue
			expect(h.source, `${h.name} claims "${h.status}" with no source`).toBeTruthy()
			expect(h.source, `${h.name}'s source is not a URL`).toMatch(/^https:\/\//)
		}
	})

	it("requires a verbatim quote for any claim other than not_found", () => {
		for (const h of HOSTS) {
			if (h.status === "not_found") continue
			expect(h.quote, `${h.name} claims "${h.status}" with nothing quoted`).toBeTruthy()
			expect(h.quote!.length, `${h.name}'s quote is too long to be verbatim`).toBeLessThan(260)
		}
	})

	it("never cites a third party as evidence of a host's own position", () => {
		// Reddit, news and other blogs are not the host speaking. They may be
		// mentioned in notes; they may never be the source for a status.
		const thirdParty = /reddit\.com|bleepingcomputer|theregister|news\.ycombinator|medium\.com|wordpress\.org/i
		for (const h of HOSTS) {
			if (!h.source) continue
			expect(h.source, `${h.name}'s source is a third party`).not.toMatch(thirdParty)
		}
	})

	it("carries no quote or date on a not_found row", () => {
		for (const h of HOSTS.filter((h) => h.status === "not_found")) {
			expect(h.quote, `${h.name} is not_found but has a quote`).toBeNull()
			expect(h.sourceDate, `${h.name} is not_found but has a date`).toBeNull()
		}
	})

	it("dates every source it dates at all in ISO form, and never in the future", () => {
		for (const h of HOSTS) {
			if (!h.sourceDate) continue
			expect(h.sourceDate, `${h.name} has a malformed date`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
			expect(
				h.sourceDate <= HOSTS_REVIEWED,
				`${h.name} is dated after the review date`,
			).toBe(true)
		}
	})

	it("records when the table was last reviewed", () => {
		expect(HOSTS_REVIEWED).toMatch(/^\d{4}-\d{2}-\d{2}$/)
	})
})

describe("lookups", () => {
	it("finds a host by slug and returns null otherwise", () => {
		expect(hostBySlug("definitely-not-a-host")).toBeNull()
		for (const h of HOSTS) {
			expect(hostBySlug(h.slug)?.name).toBe(h.name)
		}
	})

	it("maps a detected platform header to its page", () => {
		for (const h of HOSTS) {
			for (const sig of h.headerSignatures) {
				expect(hostForPlatform(sig)?.slug, `"${sig}" did not resolve to ${h.slug}`).toBe(
					h.slug,
				)
			}
		}
	})

	it("returns null for a platform we have no page for", () => {
		expect(hostForPlatform("Some Unknown Server 1.0")).toBeNull()
	})

	it("does not let two hosts claim the same header signature", () => {
		const seen = new Map<string, string>()
		for (const h of HOSTS) {
			for (const sig of h.headerSignatures) {
				const key = sig.toLowerCase()
				expect(seen.has(key), `"${sig}" claimed by both ${seen.get(key)} and ${h.slug}`).toBe(
					false,
				)
				seen.set(key, h.slug)
			}
		}
	})
})

describe("status wording", () => {
	it("never states a conclusion we have not evidenced", () => {
		for (const status of [
			"published_patched",
			"published_acknowledged",
			"published_action_required",
			"not_found",
		] as const) {
			const label = statusLabel(status)
			expect(label.length).toBeGreaterThan(3)
			// "Says it has patched" is reporting. "Is patched" would be asserting.
			if (status === "published_patched") {
				expect(label).toMatch(/says/i)
			}
			if (status === "not_found") {
				expect(label).toMatch(/no public statement/i)
			}
		}
	})
})
