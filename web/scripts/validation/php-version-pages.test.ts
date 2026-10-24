import { describe, it, expect } from "vitest"

import { PHP_RELEASES, PHP_RELEASE_ORDER } from "@/lib/php-check/php-releases"
import { FIXED_IN, PHP2SHELL } from "@/lib/php-check/php-versions"
import {
	allVersions,
	humanDate,
	buildVersionFacts,
	relatedVersions,
	versionAnswer,
	versionDescription,
	versionTitle,
} from "@/lib/php-check/version-page"

/**
 * The per-release pages under /php/*.
 *
 * Two hundred and five public pages, each making a statement about a real
 * security advisory, all generated from one data file. Nothing here is written
 * per version by hand, which removes the mistyped-version-number risk — and
 * these tests are what stops the generator reintroducing it.
 *
 * The honesty rule from the checker carries over and matters more here,
 * because the page title is literally the question "Is PHP 8.3.28
 * vulnerable?". Answering it is fine. Telling a reader their own server is
 * vulnerable is not, because distributions backport fixes without changing
 * version strings, so it cannot be known from a version number alone.
 */

describe("release data", () => {
	it("has a plausible number of releases, so a truncated feed is visible", () => {
		expect(PHP_RELEASE_ORDER.length).toBeGreaterThan(150)
		expect(PHP_RELEASE_ORDER.length).toBe(Object.keys(PHP_RELEASES).length)
	})

	it("contains every release that carried the October 2026 fix", () => {
		for (const v of Object.values(FIXED_IN)) {
			expect(PHP_RELEASES[v], `${v} missing from release data`).toBeTruthy()
		}
	})

	it("dates every release in ISO form", () => {
		for (const [v, date] of Object.entries(PHP_RELEASES)) {
			expect(date, `${v} has a malformed date`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
		}
	})

	it("is ordered oldest to newest within each branch", () => {
		const branches = new Map<string, string[]>()
		for (const v of PHP_RELEASE_ORDER) {
			const b = v.split(".").slice(0, 2).join(".")
			branches.set(b, [...(branches.get(b) ?? []), v])
		}
		for (const [branch, list] of branches) {
			const patches = list.map((v) => Number(v.split(".")[2]))
			const sorted = [...patches].sort((a, b) => a - b)
			expect(patches, `${branch} is out of order`).toEqual(sorted)
		}
	})

	it("only covers branches people still run", () => {
		for (const v of PHP_RELEASE_ORDER) {
			expect(v).toMatch(/^(8\.\d+|7\.4)\./)
		}
	})
})

describe("buildVersionFacts", () => {
	it("marks a release at the fix as having it", () => {
		const f = buildVersionFacts("8.3.36")!
		expect(f.hasFix).toBe(true)
		expect(f.branchSupported).toBe(true)
		expect(f.fixedIn).toBe("8.3.36")
	})

	it("marks a release before the fix as not having it", () => {
		const f = buildVersionFacts("8.3.8")!
		expect(f.hasFix).toBe(false)
		expect(f.branchSupported).toBe(true)
	})

	it("marks an end-of-life branch unsupported whatever the patch level", () => {
		expect(buildVersionFacts("8.1.31")?.branchSupported).toBe(false)
		expect(buildVersionFacts("7.4.33")?.branchSupported).toBe(false)
	})

	it("counts releases shipped since, and names the next one", () => {
		const f = buildVersionFacts("8.3.8")!
		expect(f.releasesSince).toBeGreaterThan(0)
		expect(f.nextRelease).toBe("8.3.9")
		expect(f.latestOnBranch.startsWith("8.3.")).toBe(true)
	})

	it("says there is nothing newer on a branch's latest release", () => {
		const latest = buildVersionFacts("8.3.8")!.latestOnBranch
		const f = buildVersionFacts(latest)!
		expect(f.releasesSince).toBe(0)
		expect(f.nextRelease).toBeNull()
	})

	it("returns null for a version that was never released", () => {
		expect(buildVersionFacts("8.3.999")).toBeNull()
		expect(buildVersionFacts("not-a-version")).toBeNull()
	})
})

describe("wording — the honesty constraint, across ALL 205 pages", () => {
	it("never tells a reader their own site is vulnerable", () => {
		for (const v of allVersions()) {
			const f = buildVersionFacts(v)!
			const text = [versionAnswer(f), versionTitle(f), versionDescription(f)].join(" ")
			expect(text, `${v} overclaims`).not.toMatch(/your (site|server) is vulnerable/i)
			expect(text, `${v} overclaims`).not.toMatch(/you are vulnerable/i)
			expect(text, `${v} overclaims`).not.toMatch(/\bhacked\b/i)
		}
	})

	it("always carries the backport caveat when a supported release predates the fix", () => {
		const affected = allVersions()
			.map((v) => buildVersionFacts(v)!)
			.filter((f) => f.branchSupported && !f.hasFix)

		expect(affected.length).toBeGreaterThan(20)
		for (const f of affected) {
			expect(versionAnswer(f), `${f.version} drops the caveat`).toMatch(
				/without changing the version number/i,
			)
		}
	})

	it("states the release date and the fix version in every answer", () => {
		for (const v of allVersions()) {
			const f = buildVersionFacts(v)!
			const answer = versionAnswer(f)
			expect(answer, `${v} omits its date`).toContain(humanDate(f.releaseDate))
			if (f.branchSupported && !f.hasFix) {
				expect(answer, `${v} omits the fix version`).toContain(f.fixedIn!)
			}
		}
	})


	it("renders dates for people, not as ISO log lines", () => {
		expect(humanDate("2026-10-21")).toBe("21 October 2026")
		expect(humanDate("2024-06-06")).toBe("6 June 2024")
		// No answer should leak the raw ISO form.
		for (const v of allVersions()) {
			expect(versionAnswer(buildVersionFacts(v)!)).not.toMatch(/\d{4}-\d{2}-\d{2}/)
		}
	})

	it("cites the real advisory identifiers, not invented ones", () => {
		const answer = versionAnswer(buildVersionFacts("8.3.8")!)
		expect(answer).toContain("CVE-2026-109618")
		expect(answer).toContain("CVE-2026-109619")
		expect(PHP2SHELL.advisories[0]).toBe("GHSA-w8hw-w9fx-j79w")
	})

	it("gives every page a distinct title, so these are not duplicates", () => {
		const titles = allVersions().map((v) => versionTitle(buildVersionFacts(v)!))
		expect(new Set(titles).size).toBe(titles.length)
	})

	it("gives every page a distinct answer", () => {
		const answers = allVersions().map((v) => versionAnswer(buildVersionFacts(v)!))
		expect(new Set(answers).size).toBe(answers.length)
	})
})

describe("internal linking", () => {
	it("links to nearby releases on the same branch, never to itself", () => {
		const related = relatedVersions("8.3.8")
		expect(related.length).toBeGreaterThan(2)
		expect(related).not.toContain("8.3.8")
		for (const v of related) expect(v.startsWith("8.3.")).toBe(true)
	})

	it("always offers the newest release on the branch", () => {
		const f = buildVersionFacts("8.3.1")!
		expect(relatedVersions("8.3.1")).toContain(f.latestOnBranch)
	})

	it("only links to pages that exist", () => {
		for (const v of allVersions()) {
			for (const link of relatedVersions(v)) {
				expect(buildVersionFacts(link), `${v} links to missing ${link}`).not.toBeNull()
			}
		}
	})
})
