import { MetadataRoute } from 'next'

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
      lastModified: new Date('2026-04-18'),
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
      lastModified: new Date('2026-06-16'),
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
      lastModified: new Date('2026-09-09'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/compare/google-lighthouse`,
      lastModified: new Date('2026-09-09'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/compare/hiring-a-qa-tester`,
      lastModified: new Date('2026-09-09'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/compare/browserstack`,
      lastModified: new Date('2026-09-09'),
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
