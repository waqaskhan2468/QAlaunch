import { describe, it, expect } from 'vitest';

import { selectBalancedPreview } from '@/lib/scan/ai/runAiAnalysisForScan';

/**
 * The free preview is the entire sales pitch: three issues decide whether a
 * visitor pays. These tests pin WHICH three get chosen.
 *
 * The case that matters is modelled on a real production scan of an
 * e-commerce homepage (21 Sep 2026). It had high-severity accessibility and
 * SEO findings but only medium-severity functionality and usability ones, so
 * the preview handed a shop owner "screen reader labels", "seven H1 headings"
 * and "contrast ratio 1.95:1" — none of which threatens a sale — while the
 * broken image and the disappearing-nav button stayed locked.
 */

type Issue = {
	category: string;
	severity: string;
	finding_type: string;
	confidence: number;
	title: string;
};

function issue(over: Partial<Issue> = {}): Issue {
	return {
		category: 'accessibility',
		severity: 'high',
		finding_type: 'ai_visual',
		confidence: 1,
		title: 'untitled',
		...over,
	};
}

/** Severity-sorted, the way the caller supplies them. */
const RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const sorted = (xs: Issue[]) => [...xs].sort((a, b) => RANK[a.severity] - RANK[b.severity]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = (xs: Issue[], n = 3) => selectBalancedPreview(sorted(xs) as any, n);
const titles = (xs: { title: string }[]) => xs.map((x) => x.title);

describe('selectBalancedPreview — the real production case', () => {
	const productionScan = [
		issue({ category: 'accessibility', severity: 'high', title: 'screen-reader buttons' }),
		issue({ category: 'accessibility', severity: 'high', title: 'screen-reader links' }),
		issue({ category: 'accessibility', severity: 'high', title: 'missing alt text' }),
		issue({ category: 'seo', severity: 'high', title: 'seven H1 headings' }),
		issue({ category: 'accessibility', severity: 'medium', title: 'contrast ratio' }),
		issue({ category: 'functionality', severity: 'medium', title: 'broken image' }),
		issue({ category: 'usability_ux', severity: 'medium', title: 'nav button leaves site' }),
		issue({ category: 'security', severity: 'medium', title: 'target blank' }),
		issue({ category: 'usability_ux', severity: 'low', title: 'vague headline' }),
		issue({ category: 'security', severity: 'low', title: 'no cookie banner' }),
	];

	it('shows the medium functionality bug instead of burying it', () => {
		expect(titles(run(productionScan))).toContain('broken image');
	});

	it('shows the medium usability issue too', () => {
		expect(titles(run(productionScan))).toContain('nav button leaves site');
	});

	it('no longer fills the whole preview with accessibility and SEO', () => {
		const picked = run(productionScan);
		const softCategories = picked.filter(
			(i) => i.category === 'accessibility' || i.category === 'seo',
		);
		expect(softCategories.length).toBeLessThan(picked.length);
	});
});

describe('selectBalancedPreview — ordering rules still hold', () => {
	it('still prefers a critical/high functional bug over a medium one', () => {
		const picked = run([
			issue({ category: 'functionality', severity: 'critical', title: 'checkout broken' }),
			issue({ category: 'functionality', severity: 'medium', title: 'broken image' }),
			issue({ category: 'accessibility', severity: 'high', title: 'a11y' }),
		]);
		expect(picked[0].title).toBe('checkout broken');
	});

	it('still falls back to accessibility when nothing else qualifies', () => {
		const picked = run([
			issue({ category: 'accessibility', severity: 'high', title: 'a11y one' }),
			issue({ category: 'accessibility', severity: 'high', title: 'a11y two' }),
		]);
		expect(titles(picked)).toEqual(['a11y one', 'a11y two']);
	});

	it('never exceeds the requested count', () => {
		const many = Array.from({ length: 20 }, (_, i) =>
			issue({ category: 'functionality', severity: 'medium', title: `bug ${i}` }),
		);
		expect(run(many)).toHaveLength(3);
	});

	it('excludes suggestions and low-confidence findings from the preview', () => {
		const picked = run([
			issue({ category: 'functionality', severity: 'medium', finding_type: 'suggestion', title: 'nit' }),
			issue({ category: 'functionality', severity: 'medium', confidence: 0.4, title: 'unsure' }),
			issue({ category: 'functionality', severity: 'medium', title: 'solid' }),
		]);
		expect(titles(picked)).toEqual(['solid']);
	});

	it('never repeats the same issue', () => {
		const picked = run([
			issue({ category: 'functionality', severity: 'medium', title: 'only one' }),
		]);
		expect(picked).toHaveLength(1);
	});

	it('returns an empty preview rather than inventing one', () => {
		expect(run([])).toEqual([]);
	});
});
