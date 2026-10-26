/**
 * Data shapes for the programmatic SEO pages (/fix/*, /tools/*).
 *
 * Every page is built from one of these records, never from a template with a
 * name swapped in. Google's scaled-content rules (and the August 2026 spam
 * update that enforced them) demote sites whose pages differ only by a keyword,
 * and a demotion on this domain would take the homepage and scanner with it.
 * So each record carries its own causes, fix steps, verification and sources,
 * and lib/seo-pages/quality.test.ts refuses to let a thin one through.
 */

export type PlatformSlug =
	| 'lovable'
	| 'bolt'
	| 'v0'
	| 'replit'
	| 'base44'
	| 'cursor'
	| 'bubble'
	| 'framer'
	| 'wordpress'
	| 'woocommerce'
	| 'shopify'
	| 'wix'
	| 'webflow'
	| 'squarespace'
	| 'any-website'

export type Source = { label: string; url: string }

export type GuideCause = {
	title: string
	/** Plain-language explanation, 1–3 sentences. */
	body: string
}

export type FixGuide = {
	platform: PlatformSlug
	/** URL segment after /fix/<platform>/, kebab-case. */
	problem: string
	/** The query this page is written to answer, e.g. "lovable site not indexed by google". */
	query: string
	/** Meta title — keep under 49 chars; layout.tsx appends " | QAlaunch". */
	title: string
	/** Meta description, 120–158 chars. */
	description: string
	/** The H1, phrased the way the searcher asks it. */
	h1: string
	/**
	 * Answer-first summary shown in the highlighted box under the H1. 2–4
	 * sentences that fully answer the query on their own; this is the passage
	 * answer engines lift.
	 */
	answer: string
	/** What the owner or visitor sees. */
	symptom: string
	causes: GuideCause[]
	/** Ordered fix steps. Each step may name real menus, settings or files. */
	steps: string[]
	/** Optional copy-paste prompt for an AI builder. */
	prompt?: string
	/** How to confirm it's fixed, in a browser. */
	verify: string[]
	/**
	 * What a QAlaunch scan would actually show for this problem. Only things a
	 * visitor-side, real-browser test can observe — never claim the scan sees
	 * server logs, dashboards or code.
	 */
	scanFlags: string[]
	faqs: { q: string; a: string }[]
	/** Pages consulted to write the guide. At least two. */
	sources: Source[]
	/** Other guides to link, as "platform/problem". */
	related?: string[]
	/** ISO date the guide was written or last rechecked. */
	updated: string
}

export type ToolPage = {
	slug: string
	query: string
	title: string
	description: string
	h1: string
	/** Line under the H1, above the scan box. */
	lead: string
	answer: string
	/** What the scan checks for this intent. */
	checks: { title: string; body: string }[]
	/** How to read the results. */
	reading: string[]
	/** Honest limits of an automated check. */
	limits: string[]
	faqs: { q: string; a: string }[]
	sources: Source[]
	/** Fix guides to link, as "platform/problem". */
	related: string[]
	updated: string
}
