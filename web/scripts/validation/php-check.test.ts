import { describe, it, expect } from "vitest"

import {
	buildDetectResult,
	detectWordPress,
	identifyPlatform,
	parsePhpVersion,
	readSecurityHeaders,
} from "@/lib/php-check/detect"
import {
	assessPhpVersion,
	compareVersions,
	FIXED_IN,
	PHP2SHELL,
	verdictHeadline,
} from "@/lib/php-check/php-versions"

/**
 * The PHP / WordPress hygiene check.
 *
 * Most of these tests exist to stop this feature claiming more than it knows.
 * A page that tells a stranger something about their own site's security is
 * the worst possible place for the overclaiming this product has already
 * shipped twice — fabricated locked issues, and dead links reported on a site
 * that had none, which got posted about publicly.
 *
 * The specific trap here: Debian, Ubuntu and RHEL backport security fixes
 * without changing the version string, so a server can report 8.3.8 long after
 * the fix has been applied to it. A banner number cannot establish that a site
 * is exposed. Tenable abandoned version-only detection for exactly this
 * reason. So no code path is allowed to call a site "vulnerable".
 */

describe("version comparison", () => {
	it("orders patch levels numerically, not as strings", () => {
		// The string trap: "8.3.9" > "8.3.36" alphabetically.
		expect(compareVersions("8.3.9", "8.3.36")).toBeLessThan(0)
		expect(compareVersions("8.3.36", "8.3.9")).toBeGreaterThan(0)
	})

	it("treats a missing patch component as zero", () => {
		expect(compareVersions("8.3", "8.3.0")).toBe(0)
		expect(compareVersions("8.3", "8.3.1")).toBeLessThan(0)
	})
})

describe("assessPhpVersion", () => {
	it("matches the fix versions in the GitHub advisories exactly", () => {
		// GHSA-w8hw-w9fx-j79w / GHSA-6wmf-4rv5-p3rp on github.com/php/php-src.
		expect(FIXED_IN["8.2"]).toBe("8.2.35")
		expect(FIXED_IN["8.3"]).toBe("8.3.36")
		expect(FIXED_IN["8.4"]).toBe("8.4.27")
		expect(FIXED_IN["8.5"]).toBe("8.5.12")
		expect(PHP2SHELL.cves).toEqual(["CVE-2026-109618", "CVE-2026-109619"])
		expect(PHP2SHELL.cvss).toBe(9.2)
	})

	it("calls a release at the fix patched", () => {
		expect(assessPhpVersion("8.3.36")).toEqual({
			kind: "patched",
			branch: "8.3",
			fixedIn: "8.3.36",
		})
	})

	it("calls a later release patched too", () => {
		expect(assessPhpVersion("8.3.40").kind).toBe("patched")
		expect(assessPhpVersion("8.5.12").kind).toBe("patched")
	})

	it("calls an earlier release below_fix, NOT vulnerable", () => {
		// wpbeginner.com really does advertise this one.
		const v = assessPhpVersion("8.3.8")
		expect(v.kind).toBe("below_fix")
		expect(JSON.stringify(v)).not.toMatch(/vulnerab/i)
	})

	it("flags an end-of-life branch regardless of patch level", () => {
		// 8.1 gets no security updates, so no patch level on it is current.
		expect(assessPhpVersion("8.1.99")).toEqual({
			kind: "unsupported_branch",
			branch: "8.1",
		})
		expect(assessPhpVersion("7.4.33").kind).toBe("unsupported_branch")
	})

	it("says unknown for a branch it has no data for, rather than guessing", () => {
		expect(assessPhpVersion("9.0.1").kind).toBe("unknown")
		expect(assessPhpVersion("not-a-version").kind).toBe("unknown")
		expect(assessPhpVersion(null).kind).toBe("unknown")
	})
})

describe("verdict wording — the honesty constraint", () => {
	it("never tells anyone their site is vulnerable", () => {
		const cases = [
			assessPhpVersion("8.3.8"),
			assessPhpVersion("8.2.1"),
			assessPhpVersion("7.4.33"),
			assessPhpVersion("8.3.36"),
			assessPhpVersion(null),
		]
		for (const v of cases) {
			const text = verdictHeadline(v, "8.3.8")
			expect(text).not.toMatch(/\byou are vulnerable\b/i)
			expect(text).not.toMatch(/\byour site is vulnerable\b/i)
			expect(text).not.toMatch(/\bhacked\b/i)
		}
	})

	it("tells someone below the fix that the banner may be stale", () => {
		const text = verdictHeadline(assessPhpVersion("8.3.8"), "8.3.8")
		// The backport caveat is the whole reason this is honest.
		expect(text).toMatch(/without changing that number/i)
		expect(text).toMatch(/8\.3\.36/)
	})

	it("admits plainly when nothing could be read", () => {
		expect(verdictHeadline({ kind: "unknown" }, null)).toMatch(/could not read/i)
	})
})

describe("header parsing", () => {
	const h = (o: Record<string, string>) => new Headers(o)

	it("reads a PHP version out of X-Powered-By", () => {
		expect(parsePhpVersion(h({ "x-powered-by": "PHP/8.3.8" }))).toBe("8.3.8")
	})

	it("reads one out of Server when that is where it is", () => {
		expect(parsePhpVersion(h({ server: "Apache/2.4.41 (Ubuntu) PHP/8.2.10" }))).toBe(
			"8.2.10",
		)
	})

	it("returns null when the platform is named but no version is", () => {
		// Eight of nine sites in my sample looked exactly like this.
		expect(parsePhpVersion(h({ "x-powered-by": "WordPress VIP" }))).toBeNull()
		expect(parsePhpVersion(h({ "x-powered-by": "WP Engine Headless Platform" }))).toBeNull()
		expect(parsePhpVersion(h({}))).toBeNull()
	})

	it("names the platform when the server names itself", () => {
		expect(identifyPlatform(h({ "x-powered-by": "WordPress VIP" }))).toBe("WordPress VIP")
		expect(identifyPlatform(h({ "x-powered-by": "WP Engine Headless Platform" }))).toBe(
			"WP Engine",
		)
		expect(identifyPlatform(h({ "x-powered-by": "Elementor Cloud" }))).toBe(
			"Elementor Cloud",
		)
		expect(identifyPlatform(h({}))).toBeNull()
	})

	it("reports security headers by presence", () => {
		const found = readSecurityHeaders(
			h({ "strict-transport-security": "max-age=63072000", "x-frame-options": "DENY" }),
		)
		expect(found.find((f) => f.id === "hsts")?.present).toBe(true)
		expect(found.find((f) => f.id === "xfo")?.present).toBe(true)
		expect(found.find((f) => f.id === "csp")?.present).toBe(false)
	})

	it("accepts the legacy Feature-Policy name for permissions", () => {
		const found = readSecurityHeaders(h({ "feature-policy": "camera 'none'" }))
		expect(found.find((f) => f.id === "permissions")?.present).toBe(true)
	})
})

describe("WordPress detection", () => {
	it("reads the generator tag", () => {
		const r = detectWordPress(
			new Headers(),
			`<meta name="generator" content="WordPress 6.7.1" />`,
		)
		expect(r.detected).toBe(true)
		expect(r.evidence[0]).toMatch(/WordPress 6\.7\.1/)
	})

	it("recognises wp-content and wp-includes asset paths", () => {
		expect(detectWordPress(new Headers(), `<link href="/wp-content/x.css">`).detected).toBe(
			true,
		)
	})

	it("reports xmlrpc and REST from headers alone, with no probe", () => {
		// The whole point: the server volunteers both on an ordinary page load,
		// so neither path is ever requested.
		const r = buildDetectResult({
			finalUrl: "https://example.com/",
			httpStatus: 200,
			requestedHttp: false,
			headers: new Headers({
				"x-pingback": "https://example.com/xmlrpc.php",
				link: '<https://example.com/wp-json/>; rel="https://api.w.org/"',
			}),
			html: "",
		})
		expect(r.xmlrpcAdvertised).toBe(true)
		expect(r.restApiAdvertised).toBe(true)
	})

	it("says not-WordPress rather than guessing", () => {
		expect(detectWordPress(new Headers(), "<html><body>hi</body></html>").detected).toBe(
			false,
		)
	})
})

describe("buildDetectResult", () => {
	it("notes an http request that was upgraded to https", () => {
		const r = buildDetectResult({
			finalUrl: "https://example.com/",
			httpStatus: 200,
			requestedHttp: true,
			headers: new Headers(),
			html: "",
		})
		expect(r.servedOverHttps).toBe(true)
		expect(r.redirectedToHttps).toBe(true)
	})

	it("carries the raw banner through unchanged for display", () => {
		const r = buildDetectResult({
			finalUrl: "https://example.com/",
			httpStatus: 200,
			requestedHttp: false,
			headers: new Headers({ "x-powered-by": "PHP/8.3.8" }),
			html: "",
		})
		expect(r.phpVersionDetected).toBe("8.3.8")
		expect(r.phpVerdict.kind).toBe("below_fix")
	})
})
