import { describe, it, expect } from 'vitest';

import { buildProofOfWork } from '@/lib/scan/proof-of-work';

/**
 * The panel this feeds exists to answer one customer objection: "it only shows
 * 3 issues and there are many other tools like this." So the rule that matters
 * most is that it never claims work the scan did not do — an inflated number
 * here is worse than no panel at all.
 */

const FULL = {
	links: { totalLinks: 62, checkedLinks: 47, brokenLinks: [{ url: 'a' }, { url: 'b' }] },
	interactionTests: { testsRun: 12, testsFailed: 1 },
	responsive: [{ width: 390 }, { width: 1280 }],
	axeViolations: [{ id: 'color-contrast' }, { id: 'button-name' }],
	consoleMessages: [{ type: 'error' }, { type: 'log' }, { type: 'severe' }],
	failedRequests: [{ url: 'x' }],
};

const build = (pw: unknown, shots = true) =>
	buildProofOfWork({
		playwrightData: pw,
		hasDesktopScreenshot: shots,
		hasMobileScreenshot: shots,
	});

describe('buildProofOfWork', () => {
	it('reports every kind of work a full scan did', () => {
		const p = build(FULL);
		const labels = p.stats.map((s) => s.label);
		expect(labels).toContain('links followed');
		expect(labels).toContain('interactions tested');
		expect(labels).toContain('screen widths');
		expect(labels).toContain('accessibility rules broken');
		expect(labels).toContain('browser errors caught');
	});

	it('counts links actually checked, not links merely found', () => {
		const stat = build(FULL).stats.find((s) => s.label === 'links followed');
		expect(stat?.value).toBe('47');
		expect(stat?.detail).toBe('2 broken');
	});

	it('says "all reachable" rather than "0 broken" when nothing is broken', () => {
		const p = build({ ...FULL, links: { checkedLinks: 20, brokenLinks: [] } });
		expect(p.stats.find((s) => s.label === 'links followed')?.detail).toBe('all reachable');
	});

	it('counts only error-level console output, not every log line', () => {
		// 2 errors (error + severe) + 1 failed request = 3
		expect(build(FULL).stats.find((s) => s.label === 'browser errors caught')?.value).toBe('3');
	});

	it('reports the real viewport range', () => {
		const p = build(FULL);
		expect(p.viewportWidths).toEqual([390, 1280]);
		expect(p.stats.find((s) => s.label === 'screen widths')?.detail).toBe('390–1280px');
	});

	it('uses singular wording for a count of one', () => {
		const p = build({
			links: { checkedLinks: 1, brokenLinks: [] },
			interactionTests: { testsRun: 1, testsFailed: 0 },
			responsive: [{ width: 390 }],
		});
		const labels = p.stats.map((s) => s.label);
		expect(labels).toContain('link followed');
		expect(labels).toContain('interaction tested');
		expect(labels).toContain('screen width');
	});
});

describe('buildProofOfWork — never overclaims', () => {
	it('omits a stat entirely rather than showing zero', () => {
		const p = build({ links: { checkedLinks: 0, brokenLinks: [] }, interactionTests: { testsRun: 0 } });
		expect(p.stats.map((s) => s.label)).not.toContain('links followed');
		expect(p.stats.map((s) => s.label)).not.toContain('interactions tested');
	});

	it('returns no stats at all for an empty payload', () => {
		expect(build({}).stats).toEqual([]);
		expect(build(null).stats).toEqual([]);
	});

	it.each([undefined, null, 'string', 42, []])(
		'survives malformed playwright_data (%s)',
		(bad) => {
			expect(() => build(bad)).not.toThrow();
			expect(build(bad).stats).toEqual([]);
		},
	);

	it('ignores non-numeric or negative counts rather than rendering them', () => {
		const p = build({
			links: { checkedLinks: -5, brokenLinks: [] },
			interactionTests: { testsRun: 'many' },
			responsive: [{ width: null }, { width: 'wide' }],
		});
		expect(p.stats).toEqual([]);
		expect(p.viewportWidths).toEqual([]);
	});

	it('tracks screenshot availability honestly', () => {
		expect(build(FULL, true).hasScreenshots).toBe(true);
		expect(
			buildProofOfWork({
				playwrightData: FULL,
				hasDesktopScreenshot: false,
				hasMobileScreenshot: false,
			}).hasScreenshots,
		).toBe(false);
	});
});
