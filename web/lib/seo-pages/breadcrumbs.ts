import { SITE_URL } from '@/lib/seo/structured-data'

/** BreadcrumbList schema from the same crumbs the page renders. */
export function breadcrumbSchema(crumbs: { name: string; path: string }[]) {
	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: crumbs.map((c, i) => ({
			'@type': 'ListItem',
			position: i + 1,
			name: c.name,
			item: `${SITE_URL}${c.path}`,
		})),
	}
}
