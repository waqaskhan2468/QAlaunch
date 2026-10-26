import { MetadataRoute } from 'next'
import { HOSTS } from '@/lib/php-check/hosts';
import { PHP_RELEASE_ORDER } from '@/lib/php-check/php-releases';
import { ALL_GUIDES, activePlatforms, guidesFor } from '@/lib/seo-pages';
import { TOOLS } from '@/lib/seo-pages/tools';

/** Latest `updated` date among a set of programmatic pages. */
function latest(dates: string[]): Date {
  return new Date(dates.reduce((a, b) => (a > b ? a : b)))
}

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://getqalaunch.com'

  // Real per-page last-modified dates. Using `new Date()` here (evaluated on
  // every request, since this route is dynamic) told Google every URL changed
  // every single day — a known crawl-trust anti-pattern that wastes the
  // limited crawl budget a new, low-authority domain gets, and can make
  // Google discount the lastmod signal entirely. Update a date below when you
  // meaningfully edit that page's content.
  return [
    {
      url: baseUrl,
      lastModified: new Date('2026-09-16'),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date('2026-05-07'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date('2026-05-07'),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date('2026-09-11'),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date('2026-06-16'),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/refund`,
      lastModified: new Date('2026-06-16'),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date('2026-07-07'),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date('2026-07-10'),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/compare`,
      lastModified: new Date('2026-09-16'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/compare/google-lighthouse`,
      lastModified: new Date('2026-09-16'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/compare/hiring-a-qa-tester`,
      lastModified: new Date('2026-09-16'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/compare/browserstack`,
      lastModified: new Date('2026-09-16'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/for-base44`,
      lastModified: new Date('2026-09-09'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/for-replit`,
      lastModified: new Date('2026-09-09'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/for-v0`,
      lastModified: new Date('2026-09-09'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/for-claude`,
      lastModified: new Date('2026-09-09'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/for-lovable`,
      lastModified: new Date('2026-07-07'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/for-bolt`,
      lastModified: new Date('2026-07-07'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/for-shopify`,
      lastModified: new Date('2026-07-07'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/for-wordpress`,
      lastModified: new Date('2026-07-07'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
		{
			url: `${baseUrl}/php-version-checker`,
			lastModified: new Date('2026-10-24'),
			changeFrequency: 'weekly',
			priority: 0.9,
		},
		// One page per PHP release. People search exact patch levels, and no
		// incumbent holds any individual version page.
		...PHP_RELEASE_ORDER.map((version) => ({
			url: `${baseUrl}/php/${version}`,
			lastModified: new Date('2026-10-24'),
			changeFrequency: 'monthly' as const,
			priority: 0.6,
		})),
		// Per-host patch status: the index table, then a page per host.
		{
			url: `${baseUrl}/php/host`,
			lastModified: new Date('2026-10-24'),
			changeFrequency: 'weekly' as const,
			priority: 0.8,
		},
		...HOSTS.map((host) => ({
			url: `${baseUrl}/php/host/${host.slug}`,
			lastModified: new Date('2026-10-24'),
			changeFrequency: 'weekly' as const,
			priority: 0.7,
		})),
    // Programmatic fix guides and tool pages (lib/seo-pages). Dates come from
    // each record's `updated` field, so a page only looks changed when it was.
    {
      url: `${baseUrl}/fix`,
      lastModified: latest(ALL_GUIDES.map((g) => g.updated)),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
    ...activePlatforms().map((p) => ({
      url: `${baseUrl}/fix/${p.slug}`,
      lastModified: latest(guidesFor(p.slug).map((g) => g.updated)),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    ...ALL_GUIDES.map((g) => ({
      url: `${baseUrl}/fix/${g.platform}/${g.problem}`,
      lastModified: new Date(g.updated),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    {
      url: `${baseUrl}/tools`,
      lastModified: latest(TOOLS.map((t) => t.updated)),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    },
    ...TOOLS.map((t) => ({
      url: `${baseUrl}/tools/${t.slug}`,
      lastModified: new Date(t.updated),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    {
      url: `${baseUrl}/blog/vibe-coding-website-bugs`,
      lastModified: new Date('2026-07-07'),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/blog/website-looks-fine-on-desktop-broken-on-mobile`,
      lastModified: new Date('2026-07-07'),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/blog/contact-form-not-working`,
      lastModified: new Date('2026-07-07'),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/blog/test-base44-app-before-launch`,
      lastModified: new Date('2026-07-10'),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/blog/shopify-mobile-checkout-bugs`,
      lastModified: new Date('2026-08-05'),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/blog/wordpress-broken-after-update`,
      lastModified: new Date('2026-08-05'),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ]
}
