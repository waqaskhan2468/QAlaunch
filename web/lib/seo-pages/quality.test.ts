import { describe, expect, it } from 'vitest'

import { ALL_GUIDES, getGuide, guideKey } from './index'
import { PLATFORMS } from './platforms'
import { TOOLS } from './tools'
import type { FixGuide, ToolPage } from './types'

/**
 * Publishing gate for the programmatic pages.
 *
 * Google demotes sites for "scaled content": many pages that differ only by a
 * swapped keyword. On a young domain a demotion would hit the homepage and the
 * scanner too, so a thin or templated page must fail here rather than ship.
 * Loosening a threshold to get a page through defeats the point; improve the
 * page instead.
 */

const guideText = (g: FixGuide) =>
	[
		g.answer,
		g.symptom,
		...g.causes.flatMap((c) => [c.title, c.body]),
		...g.steps,
		g.prompt ?? '',
		...g.verify,
		...g.scanFlags,
		...g.faqs.flatMap((f) => [f.q, f.a]),
	].join(' ')

const toolText = (t: ToolPage) =>
	[t.lead, t.answer, ...t.checks.flatMap((c) => [c.title, c.body]), ...t.reading, ...t.limits, ...t.faqs.flatMap((f) => [f.q, f.a])].join(' ')

const words = (s: string) => s.split(/\s+/).filter(Boolean).length

const sentences = (s: string) =>
	s
		.split(/(?<=[.!?])\s+/)
		.map((x) => x.trim().toLowerCase())
		.filter((x) => words(x) >= 12)

/** Claims we can't back: there is no published QAlaunch dataset yet. */
const UNBACKED_CLAIM = /\b(we|our)\s+(scanned|tested|audited|analy[sz]ed|data|research|study)\b|\d+(\.\d+)?\s?%/i

describe('fix guides', () => {
	it('has at least one guide', () => {
		expect(ALL_GUIDES.length).toBeGreaterThan(0)
	})

	it('has unique URLs, titles, descriptions and H1s', () => {
		for (const field of ['title', 'description', 'h1', 'query'] as const) {
			const values = ALL_GUIDES.map((g) => g[field].toLowerCase())
			expect(new Set(values).size, field).toBe(values.length)
		}
		const keys = ALL_GUIDES.map(guideKey)
		expect(new Set(keys).size).toBe(keys.length)
	})

	for (const g of ALL_GUIDES) {
		describe(guideKey(g), () => {
			it('has a valid slug and known platform', () => {
				expect(g.problem).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
				expect(PLATFORMS[g.platform]).toBeDefined()
			})

			it('fits search snippet lengths', () => {
				expect(g.title.length, g.title).toBeLessThanOrEqual(49)
				expect(g.description.length, g.description).toBeGreaterThanOrEqual(110)
				expect(g.description.length, g.description).toBeLessThanOrEqual(160)
			})

			it('has enough substance to stand on its own', () => {
				expect(g.causes.length).toBeGreaterThanOrEqual(2)
				expect(g.steps.length).toBeGreaterThanOrEqual(4)
				expect(g.verify.length).toBeGreaterThanOrEqual(2)
				expect(g.scanFlags.length).toBeGreaterThanOrEqual(1)
				expect(g.faqs.length).toBeGreaterThanOrEqual(3)
				expect(words(guideText(g))).toBeGreaterThanOrEqual(550)
			})

			it('cites at least two real sources', () => {
				expect(g.sources.length).toBeGreaterThanOrEqual(2)
				for (const s of g.sources) expect(s.url).toMatch(/^https:\/\//)
			})

			it('makes no claim the product cannot back', () => {
				expect(guideText(g)).not.toMatch(UNBACKED_CLAIM)
			})

			it('links only to guides that exist', () => {
				for (const ref of g.related ?? []) {
					const [platform, problem] = ref.split('/')
					expect(getGuide(platform, problem), ref).toBeDefined()
				}
			})

			it('has a real date', () => {
				expect(Number.isNaN(Date.parse(g.updated))).toBe(false)
			})
		})
	}

	it('does not repeat boilerplate sentences across pages', () => {
		const seen = new Map<string, Set<string>>()
		for (const g of ALL_GUIDES) {
			for (const s of new Set(sentences(guideText(g)))) {
				if (!seen.has(s)) seen.set(s, new Set())
				seen.get(s)!.add(guideKey(g))
			}
		}
		const repeated = [...seen].filter(([, pages]) => pages.size >= 3).map(([s, pages]) => `${[...pages].join(', ')}: ${s}`)
		expect(repeated).toEqual([])
	})
})

describe('tool pages', () => {
	it('has unique slugs and titles', () => {
		expect(new Set(TOOLS.map((t) => t.slug)).size).toBe(TOOLS.length)
		expect(new Set(TOOLS.map((t) => t.title)).size).toBe(TOOLS.length)
	})

	for (const t of TOOLS) {
		describe(t.slug, () => {
			it('fits snippet lengths and has substance', () => {
				expect(t.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
				expect(t.title.length, t.title).toBeLessThanOrEqual(49)
				expect(t.description.length).toBeGreaterThanOrEqual(110)
				expect(t.description.length).toBeLessThanOrEqual(160)
				expect(t.checks.length).toBeGreaterThanOrEqual(3)
				expect(t.limits.length).toBeGreaterThanOrEqual(2)
				expect(t.faqs.length).toBeGreaterThanOrEqual(3)
				expect(words(toolText(t))).toBeGreaterThanOrEqual(450)
			})

			it('makes no claim the product cannot back', () => {
				expect(toolText(t)).not.toMatch(UNBACKED_CLAIM)
			})

			it('links only to guides that exist', () => {
				for (const ref of t.related) {
					const [platform, problem] = ref.split('/')
					expect(getGuide(platform, problem), ref).toBeDefined()
				}
			})
		})
	}
})
