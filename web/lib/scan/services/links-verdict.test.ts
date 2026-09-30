import { describe, it, expect } from 'vitest';

import type { ValidatedLink } from '@/lib/scan/types/scan.types';

/**
 * Which links are allowed to be called broken.
 *
 * A real user posted publicly that QAlaunch "says my site is full of dead links
 * and error pages and it's not" — on a site scoring 100 across the board in
 * PageSpeed. The cause was the browser re-verification cap: links answering 403
 * or timing out are re-checked in a real browser, but only the first
 * MAX_BROWSER_REVERIFY of them. Everything past the cap was reported as broken
 * on no evidence, and a site behind Cloudflare easily produces a dozen 403s.
 *
 * The rule these tests hold: a 404 is broken; "we could not confirm" is not.
 */

const link = (over: Partial<ValidatedLink> = {}): ValidatedLink =>
	({ href: 'https://example.com/a', text: 'a', status: 200, ok: true, ...over }) as ValidatedLink;

/** The production filter, kept in sync with collectLinks(). */
const brokenOf = (links: ValidatedLink[]) => links.filter((l) => !l.ok && !l.unverified);

describe('broken-link verdict', () => {
	it('reports a confirmed 404', () => {
		const links = [link({ status: 404, ok: false })];
		expect(brokenOf(links)).toHaveLength(1);
	});

	it('reports a 403 that WAS re-checked in the browser and still failed', () => {
		// Re-checked and not cleared, so unverified was never set.
		const links = [link({ status: 403, ok: false })];
		expect(brokenOf(links)).toHaveLength(1);
	});

	it('does NOT report a 403 that we ran out of budget to re-check', () => {
		const links = [link({ status: 403, ok: false, unverified: true })];
		expect(brokenOf(links)).toEqual([]);
	});

	it('does NOT report an unconfirmed timeout as a dead link', () => {
		// status 0 means "fetch could not confirm", not "confirmed gone".
		const links = [link({ status: 0, ok: false, unverified: true })];
		expect(brokenOf(links)).toEqual([]);
	});

	it('survives the Cloudflare case that caused the complaint', () => {
		// 20 bot-blocked links, only 8 re-checked in the browser.
		const blocked = Array.from({ length: 20 }, (_, i) =>
			link({ href: `https://example.com/${i}`, status: 403, ok: false, unverified: i >= 8 }),
		);
		// Only the 8 we actually confirmed may be reported.
		expect(brokenOf(blocked)).toHaveLength(8);
	});

	it('still reports genuine 404s mixed in with unverifiable ones', () => {
		const links = [
			link({ href: 'https://example.com/gone', status: 404, ok: false }),
			link({ href: 'https://example.com/blocked', status: 403, ok: false, unverified: true }),
			link({ href: 'https://example.com/fine', status: 200, ok: true }),
		];
		expect(brokenOf(links).map((l) => l.href)).toEqual(['https://example.com/gone']);
	});

	it('never counts a working link as broken', () => {
		const links = [link({ status: 200, ok: true }), link({ status: 301, ok: true })];
		expect(brokenOf(links)).toEqual([]);
	});
});
