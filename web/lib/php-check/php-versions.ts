/**
 * PHP branch support and the October 2026 security release.
 *
 * Every number here was read from a primary source, not from a blog:
 *
 * - CVE-2026-109618 — GHSA-w8hw-w9fx-j79w on github.com/php/php-src
 * - CVE-2026-109619 — GHSA-6wmf-4rv5-p3rp on github.com/php/php-src
 *   Both CVSS v4.0 9.2 Critical, unauthenticated remote code execution.
 * - php.net/ChangeLog-8.php — 8.5.12 and 8.4.27 released 22 October 2026,
 *   both listing "Fixed GHSA-w8hw-w9fx-j79w, GHSA-6wmf-4rv5-p3rp".
 * - wordpress.org/news/2026/10/critical-php-security-release/ — 21 October
 *   2026: "No WordPress update is required or planned for these issues."
 *
 * An earlier research pass gave slightly different dates and could not
 * confirm the CVE ids at all. On a page that tells a stranger something about
 * their own site's security, a number that is nearly right is worse than no
 * number, so these are pinned to the advisories and nothing else.
 */

export const PHP2SHELL = {
	cves: ["CVE-2026-109618", "CVE-2026-109619"] as const,
	advisories: ["GHSA-w8hw-w9fx-j79w", "GHSA-6wmf-4rv5-p3rp"] as const,
	cvss: 9.2,
	severity: "Critical",
	disclosed: "2026-10-21",
	released: "2026-10-22",
} as const

/**
 * First patched release per branch. A branch not listed here receives no
 * security updates at all — per wordpress.org, "PHP versions before 8.2 no
 * longer receive security updates".
 */
export const FIXED_IN: Record<string, string> = {
	"8.2": "8.2.35",
	"8.3": "8.3.36",
	"8.4": "8.4.27",
	"8.5": "8.5.12",
}

/** Oldest branch still receiving security updates. */
const OLDEST_SUPPORTED_BRANCH = "8.2"

export type PhpVerdict =
	/** Branch is supported and the release is at or past the fix. */
	| { kind: "patched"; branch: string; fixedIn: string }
	/**
	 * Branch is supported but the release predates the fix. Deliberately NOT
	 * called "vulnerable" — see the note on backporting below.
	 */
	| { kind: "below_fix"; branch: string; fixedIn: string }
	/** Branch gets no security updates at all, whatever the patch number. */
	| { kind: "unsupported_branch"; branch: string }
	/** Something we could not parse. */
	| { kind: "unknown" }

/** Compares dotted numeric versions. Returns <0, 0 or >0. */
export function compareVersions(a: string, b: string): number {
	const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0)
	const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0)
	for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
		const d = (pa[i] ?? 0) - (pb[i] ?? 0)
		if (d !== 0) return d
	}
	return 0
}

/**
 * Classifies a PHP version string against the October 2026 release.
 *
 * IMPORTANT — why no outcome is named "vulnerable".
 *
 * Linux distributions routinely backport security fixes without changing the
 * version string. Debian, Ubuntu and RHEL all ship a package that still
 * reports 8.3.8 long after the fix for this CVE has been applied to it. A
 * banner number therefore cannot establish that a site is exposed; it can only
 * establish what the server chose to print.
 *
 * Tenable abandoned version-only detection for this reason, describing it as
 * false-positive prone. Telling a stranger's customers that their business is
 * vulnerable, on evidence that is wrong a meaningful share of the time, is a
 * claim this product should not make — and it is the same overclaiming that
 * has already cost this product trust twice in public.
 *
 * So the strongest statement available from outside is "this release predates
 * the fix; confirm on your own server", and that is what `below_fix` means.
 */
export function assessPhpVersion(version: string | null): PhpVerdict {
	if (!version) return { kind: "unknown" }

	const m = /^(\d+)\.(\d+)(?:\.(\d+))?/.exec(version.trim())
	if (!m) return { kind: "unknown" }

	const branch = `${m[1]}.${m[2]}`
	const full = `${m[1]}.${m[2]}.${m[3] ?? "0"}`

	if (compareVersions(branch, OLDEST_SUPPORTED_BRANCH) < 0) {
		return { kind: "unsupported_branch", branch }
	}

	const fixedIn = FIXED_IN[branch]
	// A branch newer than anything we know about: do not guess.
	if (!fixedIn) return { kind: "unknown" }

	return compareVersions(full, fixedIn) >= 0 ?
			{ kind: "patched", branch, fixedIn }
		:	{ kind: "below_fix", branch, fixedIn }
}

/**
 * The one-line answer, worded so it is true even when the banner is stale.
 *
 * Phrasing rule, applied throughout: describe what was detected and what the
 * advisory says, never assert a conclusion about the reader's site.
 */
export function verdictHeadline(v: PhpVerdict, detected: string | null): string {
	switch (v.kind) {
		case "patched":
			return `Your server reports PHP ${detected}, which is at or above ${v.fixedIn} — the release that fixed ${PHP2SHELL.cves[0]} and ${PHP2SHELL.cves[1]}.`
		case "below_fix":
			return `Your server reports PHP ${detected}. The fix for ${PHP2SHELL.cves[0]} and ${PHP2SHELL.cves[1]} shipped in ${v.fixedIn}, so this release predates it — though many hosts patch without changing that number. Confirm on your own server.`
		case "unsupported_branch":
			return `Your server reports PHP ${detected}. The ${v.branch} branch no longer receives security updates at all, so no patch level on it is current.`
		case "unknown":
			return `We could not read a PHP version from your server.`
	}
}
