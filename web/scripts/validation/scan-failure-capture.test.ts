import { expect, test } from 'vitest';

import { buildPlaywrightIndexPayload } from '@/lib/scan/playwright-payload';

test('failed-page payload carries the reason when one is given', () => {
	const p = buildPlaywrightIndexPayload(false, 'page timeout after 240000ms') as Record<
		string,
		unknown
	>;
	expect(p.scanOk).toBe(false);
	expect(p.failureReason).toBe('page timeout after 240000ms');
});

test('omits the field entirely when there is no reason', () => {
	const p = buildPlaywrightIndexPayload(false) as Record<string, unknown>;
	expect(p.scanOk).toBe(false);
	expect('failureReason' in p).toBe(false);
});

test('successful pages are unchanged', () => {
	const p = buildPlaywrightIndexPayload(true) as Record<string, unknown>;
	expect(p.scanOk).toBe(true);
	expect(p.playwrightDataVersion).toBe(3);
	expect('failureReason' in p).toBe(false);
});
