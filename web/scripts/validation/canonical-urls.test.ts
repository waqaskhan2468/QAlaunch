import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every indexable page must declare its OWN canonical URL.
 *
 * This is here because of a real and expensive bug. app/layout.tsx carried
 * `alternates: { canonical: "/" }`, and Next inherits metadata down the tree —
 * so seventeen pages, including every blog post and four platform landing
 * pages, told Google they were duplicates of the homepage. That is an explicit
 * instruction not to index them. It was live for months: impressions grew 7×
 * while clicks stayed flat, positions sat at 32-74, and Ahrefs reported zero
 * organic keywords for the whole domain.
 *
 * The failure mode is silent — nothing errors, pages render perfectly, and the
 * only symptom is traffic that never arrives. Hence a test.
 */

const ROOT = join(__dirname, '..', '..');

/** noindex by design, so a canonical is meaningless for them. */
const NOINDEX_PAGES = [
	'app/admin/page.tsx',
	'app/admin/login/page.tsx',
	'app/checkout/page.tsx',
	'app/checkout/success/page.tsx',
	'app/result/page.tsx',
];

/** Pages whose canonical comes from a shared metadata builder. */
const BUILDER_PAGES = [
	'app/for-base44/page.tsx',
	'app/for-replit/page.tsx',
	'app/for-v0/page.tsx',
	'app/for-claude/page.tsx',
	'app/compare/browserstack/page.tsx',
	'app/compare/google-lighthouse/page.tsx',
	'app/compare/hiring-a-qa-tester/page.tsx',
];

const INDEXABLE_PAGES = [
	'app/page.tsx',
	'app/about/page.tsx',
	'app/blog/page.tsx',
	'app/blog/contact-form-not-working/page.tsx',
	'app/blog/shopify-mobile-checkout-bugs/page.tsx',
	'app/blog/test-base44-app-before-launch/page.tsx',
	'app/blog/vibe-coding-website-bugs/page.tsx',
	'app/blog/website-looks-fine-on-desktop-broken-on-mobile/page.tsx',
	'app/blog/wordpress-broken-after-update/page.tsx',
	'app/compare/page.tsx',
	'app/contact/page.tsx',
	'app/for-bolt/page.tsx',
	'app/for-lovable/page.tsx',
	'app/for-shopify/page.tsx',
	'app/for-wordpress/page.tsx',
	'app/pricing/page.tsx',
	'app/privacy/page.tsx',
	'app/refund/page.tsx',
	'app/terms/page.tsx',
];

const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

/** Route a page file serves, e.g. app/blog/page.tsx -> /blog */
function routeFor(rel: string): string {
	return rel.replace(/^app/, '').replace(/\/page\.tsx$/, '') || '/';
}

describe('canonical URLs', () => {
	it('the root layout does NOT set a site-wide canonical', () => {
		const layout = read('app/layout.tsx');
		// Anything matching `canonical:` inside the layout's metadata is inherited
		// by every page that does not override it. That is the original bug.
		const inMetadata = layout.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
		expect(inMetadata).not.toMatch(/alternates\s*:\s*\{[^}]*canonical/);
	});

	it.each(INDEXABLE_PAGES)('%s declares its own canonical', (rel) => {
		const src = read(rel);
		const route = routeFor(rel);
		expect(src).toMatch(/alternates\s*:\s*\{\s*canonical\s*:/);
		// The canonical must be this page's route, not some other page's.
		expect(src).toMatch(
			new RegExp(`canonical\\s*:\\s*['"\`]${route.replace(/\//g, '\\/')}['"\`]`),
		);
	});

	it.each(BUILDER_PAGES)('%s gets a canonical from its metadata builder', (rel) => {
		expect(existsSync(join(ROOT, rel))).toBe(true);
	});

	it('both metadata builders set a canonical', () => {
		expect(read('components/platform/platform-page.tsx')).toMatch(/canonical:/);
		expect(read('components/compare/compare-page.tsx')).toMatch(/canonical:/);
	});

	it('noindex pages are deliberately excluded, and really are noindex', () => {
		for (const rel of NOINDEX_PAGES) {
			expect(read(rel)).toMatch(/index:\s*false/);
		}
	});

	it('every URL in the sitemap has a page that sets a canonical', () => {
		const sitemap = read('app/sitemap.ts');
		const routes = [...sitemap.matchAll(/\$\{baseUrl\}([^`]*)`/g)].map((m) => m[1] || '/');
		const covered = new Set([
			...INDEXABLE_PAGES.map(routeFor),
			...BUILDER_PAGES.map(routeFor),
		]);
		const missing = routes.filter((r) => !covered.has(r));
		expect(missing).toEqual([]);
	});
});
