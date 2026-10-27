/**
 * Shared structured-data builders.
 *
 * Every schema here is generated from the SAME array the page renders, never
 * hand-written alongside it. Google treats structured data that doesn't match
 * visible content as a violation, and hand-maintained duplicates drift the
 * moment someone edits the copy.
 *
 * Why FAQ markup matters more than it used to: AI answer engines lift
 * question/answer pairs almost verbatim, and a page can be cited by ChatGPT or
 * Perplexity without ranking in Google's top 10 at all. That makes FAQPage the
 * cheapest visibility QAlaunch can buy — 32 Q&A pairs were already written
 * across the platform and comparison pages and none of them were marked up.
 */

export const SITE_URL = 'https://getqalaunch.com';

export type FaqItem = { q: string; a: string };

/** The organisation behind every page. `sameAs` is what ties the name to a
 *  real entity, which is how an answer engine tells one "QAlaunch" from another. */
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

export const FOUNDER_ID = `${SITE_URL}/about#founder`;
export const FOUNDER_LINKEDIN = 'https://www.linkedin.com/in/wqasahmad';

/** The person behind QAlaunch, who also writes and checks every guide. One
 *  node with a stable @id so bylines, the About page and the Organization all
 *  point at the same person, tied to a real profile through `sameAs`. */
export const FOUNDER = {
	'@type': 'Person',
	'@id': FOUNDER_ID,
	name: 'Waqas Ahmad',
	jobTitle: 'QA Engineer, founder of QAlaunch',
	description: 'QA engineer with 10 years of professional software testing experience.',
	url: `${SITE_URL}/about`,
	sameAs: [FOUNDER_LINKEDIN],
	worksFor: { '@id': `${SITE_URL}/#organization` },
} as const;

export const ORGANIZATION = {
	'@type': 'Organization',
	'@id': ORGANIZATION_ID,
	name: 'QAlaunch',
	url: SITE_URL,
	logo: `${SITE_URL}/brand/qalaunch-logo-dark-bg.svg`,
	email: 'contact@getqalaunch.com',
	founder: { '@id': FOUNDER_ID },
	sameAs: ['https://x.com/QAlaunchHQ', 'https://www.linkedin.com/company/qalaunch'],
	description:
		'Website testing built by a QA engineer with 10 years of professional experience. Finds broken buttons, mobile layout failures, dead links and usability problems on any public website.',
} as const;

/**
 * FAQPage schema. Returns null for an empty list so a caller can render the
 * script tag conditionally rather than emitting an empty, invalid FAQPage.
 */
export function faqPageSchema(faqs: readonly FaqItem[]) {
	if (!faqs.length) return null;
	return {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: faqs.map((f) => ({
			'@type': 'Question',
			name: f.q,
			acceptedAnswer: { '@type': 'Answer', text: f.a },
		})),
	};
}

/**
 * Article schema for blog posts and comparison pages.
 *
 * `image` is REQUIRED by Google for an Article rich result and was missing on
 * all nine article pages, which is what Ahrefs reported as a structured-data
 * validation error. `publisher` is required too. Both now come from here so no
 * page can ship an Article without them.
 *
 * The image is the site's generated Open Graph card — a real 1200x630 PNG at a
 * stable URL, not a placeholder.
 */
export function articleSchema(input: {
	headline: string;
	description: string;
	url: string;
	datePublished: string;
	dateModified?: string;
}) {
	return {
		'@context': 'https://schema.org',
		'@type': 'Article',
		headline: input.headline,
		description: input.description,
		url: input.url,
		datePublished: input.datePublished,
		dateModified: input.dateModified ?? input.datePublished,
		image: {
			'@type': 'ImageObject',
			url: `${SITE_URL}/opengraph-image`,
			width: 1200,
			height: 630,
		},
		author: { '@id': FOUNDER_ID, '@type': 'Person', name: FOUNDER.name, url: FOUNDER.url },
		publisher: {
			'@type': 'Organization',
			'@id': ORGANIZATION_ID,
			name: 'QAlaunch',
			url: SITE_URL,
			logo: {
				'@type': 'ImageObject',
				url: `${SITE_URL}/brand/qalaunch-logo-dark-bg@2x.png`,
			},
		},
	};
}

/**
 * The site-wide entity graph, emitted once from the root layout: who runs the
 * site (Organization) and the site itself (WebSite). Every page-level schema
 * points back here by `@id` instead of repeating the organisation, which is
 * what lets an answer engine connect a fix guide, the pricing page and the
 * homepage to one entity.
 */
export function siteGraphSchema() {
	return {
		'@context': 'https://schema.org',
		'@graph': [
			ORGANIZATION,
			FOUNDER,
			{
				'@type': 'WebSite',
				'@id': WEBSITE_ID,
				url: SITE_URL,
				name: 'QAlaunch',
				inLanguage: 'en',
				publisher: { '@id': ORGANIZATION_ID },
			},
		],
	};
}

export type PriceOffer = {
	/** Tier name as shown on the pricing card. */
	name: string;
	/** What the tier covers, in the words the card uses. */
	description: string;
	priceUsd: number;
	/** Where the buyer goes to purchase this tier. */
	path: string;
};

/**
 * Product + Offer for the pricing page, one Offer per purchasable tier. Built
 * from the same price table the cards render, so the markup can never quote a
 * price the checkout doesn't charge. No aggregateRating: there are no verified
 * reviews to report.
 */
export function pricingProductSchema(offers: readonly PriceOffer[]) {
	return {
		'@context': 'https://schema.org',
		'@type': 'Product',
		'@id': `${SITE_URL}/pricing#product`,
		name: 'QAlaunch website test report',
		description:
			'A real-browser test of a public website, delivered as a PDF and web report with screenshot evidence and fix instructions for every issue found. One-time payment, no subscription.',
		url: `${SITE_URL}/pricing`,
		image: `${SITE_URL}/opengraph-image`,
		brand: { '@id': ORGANIZATION_ID },
		offers: offers.map((o) => ({
			'@type': 'Offer',
			name: o.name,
			description: o.description,
			price: String(o.priceUsd),
			priceCurrency: 'USD',
			availability: 'https://schema.org/InStock',
			url: `${SITE_URL}${o.path}`,
			seller: { '@id': ORGANIZATION_ID },
		})),
	};
}

/** Serialise for dangerouslySetInnerHTML, escaping the one sequence that can
 *  break out of a <script> block if an answer ever contains it. */
export function jsonLd(data: unknown): string {
	return JSON.stringify(data).replace(/</g, '\\u003c');
}
