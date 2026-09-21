import { describe, it, expect } from 'vitest';

import { headlineVerdict } from '@/components/audit/audit-experience';

/**
 * The hero headline is the first sentence a visitor reads on the page that
 * decides whether they pay, so it has to be both grammatical and proportionate.
 *
 * It shipped briefly as "Your homepage is needs attention." — the lead clause
 * was hardcoded while the verdict varied. Each band now carries its own lead.
 */
describe('headlineVerdict', () => {
	it.each([
		[95, 'Your homepage looks mostly healthy.'],
		[80, 'Your homepage looks mostly healthy.'],
		[79, 'Your homepage needs attention.'],
		[62, 'Your homepage needs attention.'],
		[60, 'Your homepage needs attention.'],
		[59, 'Your homepage is failing.'],
		[0, 'Your homepage is failing.'],
	])('reads correctly at %i', (score, expected) => {
		const v = headlineVerdict(score);
		expect(`${v.lead} ${v.word}`).toBe(expected);
	});

	it('only calls a site failing when it actually scores badly', () => {
		expect(headlineVerdict(62).word).not.toContain('failing');
		expect(headlineVerdict(59).word).toContain('failing');
	});

	it('gives every band a colour', () => {
		for (const score of [95, 62, 20]) {
			expect(headlineVerdict(score).color).toMatch(/^#[0-9A-Fa-f]{6}$/);
		}
	});
});
