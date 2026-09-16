import { describe, it, expect } from 'vitest';

import {
	selectRecoverable,
	hostOf,
	MIN_AGE_MS,
	MAX_AGE_MS,
	MAX_PER_RUN,
	type RecoveryCandidateRow,
} from '@/lib/checkout/recovery';
import { buildRecoveryDraft, recoveryBodyToHtml, resumeUrl } from '@/lib/checkout/recovery-draft';

const NOW = Date.parse('2026-09-16T12:00:00.000Z');

/** A row that SHOULD be recovered; individual tests break one rule at a time. */
function row(overrides: Partial<RecoveryCandidateRow> = {}): RecoveryCandidateRow {
	return {
		id: 'scan-1',
		url: 'https://www.example.com/',
		package: 'basic',
		payment_status: 'pending',
		user_email: 'buyer@example.com',
		created_at: new Date(NOW - 3 * 60 * 60 * 1000).toISOString(), // 3h ago
		recovery_sent_at: null,
		...overrides,
	};
}

describe('selectRecoverable', () => {
	it('selects an abandoned paid checkout inside the age window', () => {
		const picked = selectRecoverable([row()], NOW);
		expect(picked).toHaveLength(1);
		expect(picked[0]).toMatchObject({
			scanId: 'scan-1',
			host: 'example.com',
			pkg: 'basic',
			email: 'buyer@example.com',
		});
	});

	it('never re-emails a checkout that already received one', () => {
		const already = row({ recovery_sent_at: '2026-09-15T10:00:00.000Z' });
		expect(selectRecoverable([already], NOW)).toHaveLength(0);
	});

	it('skips checkouts that were actually paid', () => {
		expect(selectRecoverable([row({ payment_status: 'paid' })], NOW)).toHaveLength(0);
	});

	it('skips free scans — they get the follow-up flow, not this one', () => {
		expect(
			selectRecoverable([row({ package: 'free', payment_status: 'free' })], NOW),
		).toHaveLength(0);
	});

	it('skips enterprise, which is custom-quoted rather than checked out', () => {
		expect(selectRecoverable([row({ package: 'enterprise' })], NOW)).toHaveLength(0);
	});

	it('leaves a very recent checkout alone — they may still be paying', () => {
		const justNow = row({ created_at: new Date(NOW - (MIN_AGE_MS - 60_000)).toISOString() });
		expect(selectRecoverable([justNow], NOW)).toHaveLength(0);
	});

	it('takes a checkout the moment it crosses the minimum age', () => {
		const ripe = row({ created_at: new Date(NOW - (MIN_AGE_MS + 1_000)).toISOString() });
		expect(selectRecoverable([ripe], NOW)).toHaveLength(1);
	});

	it('ignores a stale checkout past the maximum age', () => {
		const old = row({ created_at: new Date(NOW - (MAX_AGE_MS + 60_000)).toISOString() });
		expect(selectRecoverable([old], NOW)).toHaveLength(0);
	});

	it.each([
		{ email: '', label: 'empty' },
		{ email: 'not-an-email', label: 'malformed' },
		{ email: null, label: 'missing' },
	])('skips a row whose email is $label', ({ email }) => {
		expect(selectRecoverable([row({ user_email: email })], NOW)).toHaveLength(0);
	});

	it('skips a row with an unparseable created_at rather than throwing', () => {
		expect(selectRecoverable([row({ created_at: 'not a date' })], NOW)).toHaveLength(0);
	});

	it('caps a backlog at MAX_PER_RUN so it drains instead of bursting', () => {
		const many = Array.from({ length: MAX_PER_RUN + 10 }, (_, i) =>
			row({ id: `scan-${i}`, user_email: `buyer${i}@example.com` }),
		);
		expect(selectRecoverable(many, NOW)).toHaveLength(MAX_PER_RUN);
	});
});

describe('hostOf', () => {
	it('strips protocol and www', () => {
		expect(hostOf('https://www.shop.com/pricing')).toBe('shop.com');
	});

	it('falls back gracefully on an unparseable url', () => {
		expect(hostOf('shop.com/x')).toBe('shop.com');
	});

	it('handles a missing url without throwing', () => {
		expect(hostOf(null)).toBe('your site');
	});
});

describe('buildRecoveryDraft', () => {
	it('names the site in the subject so it is recognisable in an inbox', () => {
		const draft = buildRecoveryDraft({ host: 'shop.com', pkg: 'basic', scanId: 'abc' });
		expect(draft.subject).toContain('shop.com');
	});

	it('links back to the existing scan, not the homepage', () => {
		const draft = buildRecoveryDraft({ host: 'shop.com', pkg: 'basic', scanId: 'abc-123' });
		expect(draft.body).toContain(resumeUrl('abc-123'));
		expect(draft.body).toContain('scanId=abc-123');
	});

	it('quotes the price of the package they actually chose', () => {
		expect(buildRecoveryDraft({ host: 'a.com', pkg: 'basic', scanId: 'x' }).body).toContain('$9');
		expect(buildRecoveryDraft({ host: 'a.com', pkg: 'standard', scanId: 'x' }).body).toContain(
			'$24',
		);
		expect(buildRecoveryDraft({ host: 'a.com', pkg: 'premium', scanId: 'x' }).body).toContain(
			'$59',
		);
	});

	it('states plainly that only one email will be sent', () => {
		const draft = buildRecoveryDraft({ host: 'shop.com', pkg: 'basic', scanId: 'x' });
		expect(draft.body).toContain("I won't send another");
	});

	it('does not invent a discount or a deadline', () => {
		const body = buildRecoveryDraft({ host: 'shop.com', pkg: 'basic', scanId: 'x' }).body;
		expect(body).not.toMatch(/discount|% off|expires|hurry|last chance/i);
	});
});

describe('recoveryBodyToHtml', () => {
	it('escapes markup so a hostile site name cannot inject into the email', () => {
		const html = recoveryBodyToHtml('<script>alert(1)</script> & more');
		expect(html).not.toContain('<script>');
		expect(html).toContain('&lt;script&gt;');
		expect(html).toContain('&amp;');
	});

	it('turns the resume link into a clickable anchor', () => {
		const html = recoveryBodyToHtml(`Pick it up: ${resumeUrl('abc')}`);
		expect(html).toContain(`<a href="https://getqalaunch.com/result?scanId=abc"`);
	});
});
