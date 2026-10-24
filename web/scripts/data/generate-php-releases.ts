/**
 * Regenerates lib/php-check/php-releases.ts from php.net's own release index.
 *
 *   npx tsx scripts/data/generate-php-releases.ts
 *
 * Run this whenever PHP ships a release. The per-version pages are built from
 * that file, so a new patch level only appears on the site once this has run
 * and the result is committed.
 *
 * Generated rather than hand-maintained on purpose: these pages tell people
 * whether a specific release predates a security fix, and a version number
 * typed by hand is a false statement waiting to happen on a public page about
 * a real vulnerability.
 */

import { writeFileSync } from "node:fs"
import { join } from "node:path"

/** 8.x in full, plus 7.4 — end of life, still widely run, still searched. */
const BRANCHES_WANTED = /^(8\.\d+|7\.4)$/

type ReleaseRecord = { date?: string }

const MONTHS: Record<string, string> = {
	Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
	Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
}

/** php.net prints "21 Oct 2026". */
function toIsoDate(raw: string): string | null {
	const m = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/.exec(raw.trim())
	if (!m) return null
	const month = MONTHS[m[2]]
	if (!month) return null
	return `${m[3]}-${month}-${m[1].padStart(2, "0")}`
}

function compare(a: string, b: string): number {
	const pa = a.split(".").map(Number)
	const pb = b.split(".").map(Number)
	for (let i = 0; i < 3; i += 1) {
		const d = (pa[i] ?? 0) - (pb[i] ?? 0)
		if (d !== 0) return d
	}
	return 0
}

async function main() {
	const releases: Record<string, string> = {}

	for (const major of ["8", "7"]) {
		const url = `https://www.php.net/releases/index.php?json=1&version=${major}&max=-1`
		const res = await fetch(url)
		if (!res.ok) throw new Error(`php.net returned ${res.status} for PHP ${major}`)
		const data = (await res.json()) as Record<string, ReleaseRecord>

		for (const [version, record] of Object.entries(data)) {
			const branch = version.split(".").slice(0, 2).join(".")
			if (!BRANCHES_WANTED.test(branch)) continue
			const iso = record.date ? toIsoDate(record.date) : null
			if (iso) releases[version] = iso
		}
	}

	const ordered = Object.keys(releases).sort(compare)
	if (ordered.length < 150) {
		// A truncated feed would silently delete pages. Fail instead.
		throw new Error(`Only ${ordered.length} releases parsed — refusing to write.`)
	}

	const body = [
		"/**",
		" * Every PHP release this site publishes a page for, with its real release",
		" * date.",
		" *",
		" * GENERATED from php.net's own release index:",
		" *   https://www.php.net/releases/index.php?json=1&version=8&max=-1",
		" *   https://www.php.net/releases/index.php?json=1&version=7&max=-1",
		" * Regenerate with `npx tsx scripts/data/generate-php-releases.ts`.",
		" *",
		" * Not hand-written, and deliberately so. These pages tell people whether a",
		" * specific release predates a security fix; a version number invented or",
		" * mistyped here becomes a false statement on a public page about a real",
		" * vulnerability.",
		" *",
		" * Scope: all of 8.x, plus 7.4 — the end-of-life branch still widely run and",
		" * still searched. Older branches are omitted because nobody is choosing",
		" * between them any more.",
		" */",
		"export const PHP_RELEASES: Readonly<Record<string, string>> = {",
		...ordered.map((v) => `\t"${v}": "${releases[v]}",`),
		"}",
		"",
		"/** Release order, oldest first. */",
		"export const PHP_RELEASE_ORDER: readonly string[] = [",
		...ordered.map((v) => `\t"${v}",`),
		"]",
		"",
	].join("\n")

	const out = join(process.cwd(), "lib/php-check/php-releases.ts")
	writeFileSync(out, body)
	console.log(`Wrote ${ordered.length} releases to ${out}`)
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
