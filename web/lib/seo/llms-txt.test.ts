import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

import { getGuide } from '@/lib/seo-pages';
import { getTool } from '@/lib/seo-pages/tools';
import { PACKAGE_PRICE_USD } from '@/components/pricing/pricing-plans';

/**
 * llms.txt is the page an answer engine reads to decide which of our URLs
 * matter. A dead link there points the engine at a 404, and a stale price gets
 * quoted back to people as fact, so both are checked against the real routes
 * and the real price table.
 */

const ROOT = join(__dirname, '..', '..');
const llms = readFileSync(join(ROOT, 'public', 'llms.txt'), 'utf8');
const paths = [...llms.matchAll(/https:\/\/getqalaunch\.com(\/[^\s)]*)?/g)].map((m) => m[1] ?? '/');

function routeExists(path: string): boolean {
	const fix = path.match(/^\/fix\/([^/]+)\/([^/]+)$/);
	if (fix) return Boolean(getGuide(fix[1], fix[2]));
	const tool = path.match(/^\/tools\/([^/]+)$/);
	if (tool) return Boolean(getTool(tool[1]));
	return existsSync(join(ROOT, 'app', path, 'page.tsx'));
}

describe('public/llms.txt', () => {
	it('links only to pages that exist', () => {
		expect(paths.length).toBeGreaterThan(10);
		expect(paths.filter((p) => !routeExists(p))).toEqual([]);
	});

	it('quotes every self-serve price the checkout charges', () => {
		for (const price of Object.values(PACKAGE_PRICE_USD)) {
			expect(llms).toContain(`$${price} one-time`);
		}
	});

	it('does not promise instant or sub-minute reports', () => {
		expect(llms).not.toMatch(/instant|60 seconds/i);
	});
});
