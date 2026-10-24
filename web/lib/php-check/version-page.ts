import { PHP_RELEASE_ORDER, PHP_RELEASES } from "./php-releases"
import { assessPhpVersion, compareVersions, FIXED_IN, PHP2SHELL } from "./php-versions"

/**
 * Facts for one PHP release's page.
 *
 * Every page under /php/* is generated from this, and all of it is derived
 * from php.net's release index plus the two php-src advisories. Nothing is
 * written by hand per version, so there is nothing to mistype.
 *
 * These pages exist because people search for exact patch levels — "php
 * 8.3.28 vulnerability" and similar are confirmed autocomplete queries — and
 * no incumbent holds any individual version page. The only thing resembling
 * one is a static GitHub Pages table with no verdict and no tool.
 *
 * The wording rule from the checker applies here too, and matters more: a
 * page titled "Is PHP 8.3.28 vulnerable?" must answer the question people
 * typed without asserting something about a reader's server that cannot be
 * known from outside it. Distributions backport fixes without changing
 * version strings, so the honest answer is about the release, never about
 * their site.
 */

export type VersionFacts = {
	version: string
	branch: string
	releaseDate: string
	/** Whether this release carries the October 2026 fix. */
	hasFix: boolean
	/** Whether the branch receives security updates at all. */
	branchSupported: boolean
	/** First release on this branch carrying the fix, when the branch has one. */
	fixedIn: string | null
	/** Releases shipped on this branch after this one. */
	releasesSince: number
	/** The next release on this branch, if any. */
	nextRelease: string | null
	/** Newest release on this branch. */
	latestOnBranch: string
}

/** "2026-10-21" -> "21 October 2026". ISO reads like a log line on a page. */
export function humanDate(iso: string): string {
	const [y, m, d] = iso.split("-").map(Number)
	const months = [
		"January", "February", "March", "April", "May", "June",
		"July", "August", "September", "October", "November", "December",
	]
	return `${d} ${months[m - 1]} ${y}`
}

export function branchOf(version: string): string {
	return version.split(".").slice(0, 2).join(".")
}

export function isKnownVersion(version: string): boolean {
	return Object.hasOwn(PHP_RELEASES, version)
}

export function allVersions(): readonly string[] {
	return PHP_RELEASE_ORDER
}

export function buildVersionFacts(version: string): VersionFacts | null {
	const releaseDate = PHP_RELEASES[version]
	if (!releaseDate) return null

	const branch = branchOf(version)
	const onBranch = PHP_RELEASE_ORDER.filter((v) => branchOf(v) === branch)
	const index = onBranch.indexOf(version)
	const verdict = assessPhpVersion(version)
	const fixedIn = FIXED_IN[branch] ?? null

	return {
		version,
		branch,
		releaseDate,
		hasFix: verdict.kind === "patched",
		branchSupported: verdict.kind !== "unsupported_branch",
		fixedIn,
		releasesSince: onBranch.length - index - 1,
		nextRelease: onBranch[index + 1] ?? null,
		latestOnBranch: onBranch[onBranch.length - 1],
	}
}

/**
 * The answer, in one self-contained sentence, placed first on the page.
 *
 * Written to be liftable: an assistant answering "is PHP 8.3.28 vulnerable"
 * needs a sentence that stands alone, states the version, states the fix, and
 * does not hedge into uselessness. It is about the release — which is a fact —
 * not about the reader's server, which is not knowable from here.
 */
export function versionAnswer(f: VersionFacts): string {
	const on = humanDate(f.releaseDate)

	if (!f.branchSupported) {
		return `PHP ${f.version} was released on ${on}, and the PHP ${f.branch} branch no longer receives security updates. It did not receive the fix for ${PHP2SHELL.cves[0]} and ${PHP2SHELL.cves[1]}, and it will not receive fixes for anything found in future either. The oldest branch still supported is 8.2.`
	}
	if (f.hasFix) {
		// The release that IS the fix reads badly as "at or after itself".
		return f.version === f.fixedIn ?
				`Yes. PHP ${f.version}, released on ${on}, is the ${f.branch} release that patched ${PHP2SHELL.cves[0]} and ${PHP2SHELL.cves[1]} (CVSS ${PHP2SHELL.cvss}, Critical).`
			:	`Yes, PHP ${f.version} includes the fix. It was released on ${on}, after ${f.fixedIn} — the ${f.branch} release that patched ${PHP2SHELL.cves[0]} and ${PHP2SHELL.cves[1]} (CVSS ${PHP2SHELL.cvss}, Critical).`
	}
	return `PHP ${f.version} was released on ${on}, before the fix for ${PHP2SHELL.cves[0]} and ${PHP2SHELL.cves[1]} shipped in PHP ${f.fixedIn}. The upstream release itself therefore predates the patch — though a server running ${f.version} may still have the fix applied, because Linux distributions backport security patches without changing the version number.`
}

/** Page title, matching how the query is actually typed. */
export function versionTitle(f: VersionFacts): string {
	return `Is PHP ${f.version} vulnerable? ${
		f.hasFix ? "No — it has the October 2026 fix"
		: !f.branchSupported ? "Branch is end of life"
		: `It predates the ${f.fixedIn} fix`
	}`
}

export function versionDescription(f: VersionFacts): string {
	if (!f.branchSupported) {
		return `PHP ${f.version} (released ${humanDate(f.releaseDate)}) is on the ${f.branch} branch, which no longer receives security updates. What that means and how to move to a supported version.`
	}
	return f.hasFix ?
			`PHP ${f.version}, released ${humanDate(f.releaseDate)}, includes the fix for ${PHP2SHELL.cves[0]} and ${PHP2SHELL.cves[1]}. Check what version your own site reports, free.`
		:	`PHP ${f.version} was released ${humanDate(f.releaseDate)}, before the fix in ${f.fixedIn}. Why that does not automatically mean your server is exposed, and how to check.`
}

/** Nearby releases, for genuine internal links rather than a dump of 205. */
export function relatedVersions(version: string, span = 4): string[] {
	const branch = branchOf(version)
	const onBranch = PHP_RELEASE_ORDER.filter((v) => branchOf(v) === branch)
	const i = onBranch.indexOf(version)
	if (i === -1) return []

	const near = onBranch.slice(Math.max(0, i - span), i + span + 1).filter((v) => v !== version)

	// Always offer the newest on the branch — it is the page someone on an old
	// release actually wants next.
	const latest = onBranch[onBranch.length - 1]
	if (latest !== version && !near.includes(latest)) near.push(latest)

	return near.sort(compareVersions)
}
