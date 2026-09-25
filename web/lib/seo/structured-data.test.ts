import { describe, it, expect } from 'vitest';

import { faqPageSchema, jsonLd, ORGANIZATION } from '@/lib/seo/structured-data';
import { PLATFORMS } from '@/lib/platform/platforms';
import { COMPARISONS } from '@/lib/compare/comparisons';
import { homeFaqs } from '@/components/home/faq';

/**
 * Structured data is invisible, so a mistake here fails silently — the markup
 * simply stops being eligible and nobody notices for months. These tests assert
 * the shape Google and the answer engines actually require.
 */

describe('faqPageSchema', () => {
	it('produces a valid FAQPage', () => {
		const schema = faqPageSchema([{ q: 'Is it free?', a: 'The first scan is.' }]);
		expect(schema).toMatchObject({
			'@context': 'https://schema.org',
			'@type': 'FAQPage',
			mainEntity: [
				{
					'@type': 'Question',
					name: 'Is it free?',
					acceptedAnswer: { '@type': 'Answer', text: 'The first scan is.' },
				},
			],
		});
	});

	it('returns null for an empty list rather than an invalid empty FAQPage', () => {
		expect(faqPageSchema([])).toBeNull();
	});

	it('keeps every question — a truncated list under-reports the page', () => {
		const many = Array.from({ length: 12 }, (_, i) => ({ q: `Q${i}`, a: `A${i}` }));
		expect(faqPageSchema(many)?.mainEntity).toHaveLength(12);
	});
});

describe('jsonLd', () => {
	it('escapes < so an answer can never break out of the script tag', () => {
		const out = jsonLd({ a: 'use <script> carefully' });
		expect(out).not.toContain('<script>');
		expect(out).toContain('\\u003c');
	});

	it('round-trips back to the original object', () => {
		const data = { '@type': 'FAQPage', text: 'a "quoted" answer & more' };
		expect(JSON.parse(jsonLd(data))).toEqual(data);
	});
});

describe('ORGANIZATION', () => {
	it('carries sameAs profiles, which is how an entity is disambiguated', () => {
		expect(ORGANIZATION.sameAs.length).toBeGreaterThan(0);
		for (const url of ORGANIZATION.sameAs) expect(url).toMatch(/^https:\/\//);
	});
});

describe('every FAQ on the site is marked up', () => {
	it('the homepage has FAQs to mark up', () => {
		expect(homeFaqs.length).toBeGreaterThan(0);
		expect(faqPageSchema(homeFaqs)?.mainEntity).toHaveLength(homeFaqs.length);
	});

	it.each(PLATFORMS.map((c) => [c.slug, c] as const))('platform %s has usable FAQ content', (_slug, cfg) => {
		const faqs = cfg.faqs;
		expect(faqs.length).toBeGreaterThan(0);
		for (const f of faqs) {
			expect(f.q.trim().length).toBeGreaterThan(5);
			// Thin answers are not cited; they also look like keyword stuffing.
			expect(f.a.trim().length).toBeGreaterThan(40);
		}
	});

	it.each(COMPARISONS.map((c) => [c.slug, c] as const))('comparison %s has usable FAQ content', (_slug, cfg) => {
		const faqs = cfg.faqs;
		expect(faqs.length).toBeGreaterThan(0);
		for (const f of faqs) {
			expect(f.q.trim().length).toBeGreaterThan(5);
			expect(f.a.trim().length).toBeGreaterThan(40);
		}
	});
});
