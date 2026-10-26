import type { FixGuide, PlatformSlug } from './types'
import { PLATFORMS } from './platforms'
import { GUIDES as AI_BUILDER_GUIDES } from './guides/ai-builders'
import { GUIDES as AI_BUILDER_GUIDES_2 } from './guides/ai-builders-2'
import { GUIDES as COMMERCE_GUIDES } from './guides/cms-commerce'
import { GUIDES as SITE_BUILDER_GUIDES } from './guides/cms-sites'

/** Every published fix guide. Add a file under guides/ and spread it here. */
export const ALL_GUIDES: readonly FixGuide[] = [...AI_BUILDER_GUIDES, ...AI_BUILDER_GUIDES_2, ...COMMERCE_GUIDES, ...SITE_BUILDER_GUIDES]

export const guideKey = (g: Pick<FixGuide, 'platform' | 'problem'>) => `${g.platform}/${g.problem}`
export const guidePath = (g: Pick<FixGuide, 'platform' | 'problem'>) => `/fix/${guideKey(g)}`

export function getGuide(platform: string, problem: string): FixGuide | undefined {
	return ALL_GUIDES.find((g) => g.platform === platform && g.problem === problem)
}

export function guidesFor(platform: PlatformSlug): FixGuide[] {
	return ALL_GUIDES.filter((g) => g.platform === platform)
}

/** Platforms that have at least one guide, in the order of PLATFORMS. */
export function activePlatforms() {
	return Object.values(PLATFORMS).filter((p) => ALL_GUIDES.some((g) => g.platform === p.slug))
}

/**
 * Related guides for a page: the explicit `related` list first, then other
 * guides on the same platform, so every page links to at least a few siblings.
 */
export function relatedGuides(guide: FixGuide, limit = 6): FixGuide[] {
	const out: FixGuide[] = []
	const seen = new Set([guideKey(guide)])
	for (const key of guide.related ?? []) {
		const [platform, problem] = key.split('/')
		const g = getGuide(platform, problem)
		if (g && !seen.has(key)) {
			out.push(g)
			seen.add(key)
		}
	}
	for (const g of guidesFor(guide.platform)) {
		if (out.length >= limit) break
		if (!seen.has(guideKey(g))) {
			out.push(g)
			seen.add(guideKey(g))
		}
	}
	return out.slice(0, limit)
}
