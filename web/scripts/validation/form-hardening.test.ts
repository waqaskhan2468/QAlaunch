import { describe, it, expect, beforeEach } from 'vitest';

import { escapeHtml, headerSafe } from '@/lib/api/email-safety';
import {
	assertFormSubmitAllowed,
	__resetFormRateLimits,
	__limits,
} from '@/lib/api/form-rate-limit';
import { auditEnquirySchema, contactFormSchema } from '@/types/zod';

/**
 * Hardening for the two public forms that send mail.
 *
 * A post about the product did numbers and the forms started receiving probe
 * payloads: `<script>alert(1)</script>`, `{{7*7}}`, `test' OR 1=1--`. All three
 * failed — the emails arrived showing the payloads as visible text — and these
 * tests hold that line so a future edit cannot quietly undo it.
 *
 * The genuine gap those submissions exposed was not any of the payloads. It was
 * that nothing limited how often either route could be called, while every call
 * spends one of 100 daily Resend sends shared with scan and report email. A
 * flood silently starves real enquiries.
 */

const req = (ip: string) =>
	new Request('https://getqalaunch.com/api/contact', {
		method: 'POST',
		headers: { 'x-forwarded-for': ip },
	});

describe('HTML escaping — why the injection attempts were inert', () => {
	it('renders a script tag as text', () => {
		expect(escapeHtml('<script>alert(1)</script>')).toBe(
			'&lt;script&gt;alert(1)&lt;/script&gt;',
		);
	});

	it('leaves template-looking input alone rather than evaluating it', () => {
		// These are plain template literals, not a template engine, so {{7*7}}
		// was never going to become 49. Asserted so nobody introduces one.
		expect(escapeHtml('{{7*7}}')).toBe('{{7*7}}');
	});

	it('escapes the quote that would break out of an attribute', () => {
		expect(escapeHtml(`" onload="alert(1)`)).toBe('&quot; onload=&quot;alert(1)');
		expect(escapeHtml("test' OR 1=1--")).toBe('test&#39; OR 1=1--');
	});

	it('escapes ampersands first, so escaping cannot be double-applied', () => {
		expect(escapeHtml('&lt;')).toBe('&amp;lt;');
	});
});

describe('header safety — the one real injection route', () => {
	it('strips CRLF so a value cannot start a new header', () => {
		const attack = 'site.com\r\nBcc: attacker@evil.com';
		const safe = headerSafe(`Manual audit enquiry — ${attack}`);
		expect(safe).not.toContain('\r');
		expect(safe).not.toContain('\n');
		expect(safe).toBe('Manual audit enquiry — site.com Bcc: attacker@evil.com');
	});

	it('strips a bare newline and a NUL just the same', () => {
		expect(headerSafe('a\nb')).toBe('a b');
		expect(headerSafe('a\u0000b')).toBe('a b');
	});

	it('caps length so mail servers do not fold unpredictably', () => {
		const out = headerSafe(`subject ${'x'.repeat(500)}`);
		expect(out.length).toBeLessThanOrEqual(160);
		expect(out.endsWith('…')).toBe(true);
	});

	it('leaves an ordinary subject untouched', () => {
		expect(headerSafe('Manual audit enquiry — https://example.com')).toBe(
			'Manual audit enquiry — https://example.com',
		);
	});
});

describe('schema validation', () => {
	const validEnquiry = { name: 'Jane', email: 'jane@example.com' };
	const validContact = {
		firstName: 'Jane',
		lastName: 'Doe',
		email: 'jane@example.com',
	};

	it('rejects a newline in a name, which reaches the Subject', () => {
		expect(
			auditEnquirySchema.safeParse({ ...validEnquiry, name: 'Jane\r\nBcc: x@y.com' })
				.success,
		).toBe(false);
		expect(
			contactFormSchema.safeParse({ ...validContact, firstName: 'Jane\nBcc: x@y.com' })
				.success,
		).toBe(false);
	});

	it('rejects a newline in the website, which also reaches the Subject', () => {
		expect(
			auditEnquirySchema.safeParse({
				...validEnquiry,
				websiteUrl: 'a.com\r\nBcc: x@y.com',
			}).success,
		).toBe(false);
	});

	it('still ACCEPTS angle brackets and quotes in free text', () => {
		// Deliberate. This product sells website bug reports, so "the nav shows a
		// raw <div> on mobile" is a customer describing their actual problem.
		// Escaping at output makes it safe; a blocklist here would bin real mail.
		const parsed = auditEnquirySchema.safeParse({
			...validEnquiry,
			concern: "my menu shows a raw <div> and the search won't accept O'Brien",
		});
		expect(parsed.success).toBe(true);
	});

	it('accepts a multi-line message, which is what a real message looks like', () => {
		const parsed = contactFormSchema.safeParse({
			...validContact,
			message: 'Line one.\nLine two.',
		});
		expect(parsed.success).toBe(true);
	});

	it('rejects an invalid email address', () => {
		expect(
			auditEnquirySchema.safeParse({ ...validEnquiry, email: 'not-an-email' }).success,
		).toBe(false);
	});

	it('enforces length caps', () => {
		expect(
			auditEnquirySchema.safeParse({ ...validEnquiry, name: 'x'.repeat(121) }).success,
		).toBe(false);
		expect(
			auditEnquirySchema.safeParse({ ...validEnquiry, concern: 'x'.repeat(2001) })
				.success,
		).toBe(false);
	});

	it('accepts the honeypot field being present and empty', () => {
		expect(
			auditEnquirySchema.safeParse({ ...validEnquiry, company: '' }).success,
		).toBe(true);
	});
});

describe('rate limiting — the gap that actually mattered', () => {
	beforeEach(() => {
		__resetFormRateLimits();
	});

	/** Minimal Supabase stand-in: a shared counter, like the real table. */
	function fakeDb(rowsByHash: Record<string, number> = {}, total = 0) {
		const inserted: { form: string; ip_hash: string }[] = [];
		const db = {
			from() {
				let ipHash: string | undefined;
				const chain = {
					select: () => chain,
					gte: () => chain,
					eq: (_col: string, v: string) => {
						ipHash = v;
						return chain;
					},
					insert: (row: { form: string; ip_hash: string }) => {
						inserted.push(row);
						return Promise.resolve({ error: null });
					},
					then: (resolve: (r: { count: number; error: null }) => void) =>
						resolve({
							count: ipHash ? (rowsByHash[ipHash] ?? 0) : total,
							error: null,
						}),
				};
				return chain;
			},
		};
		return { db: db as never, inserted };
	}

	/** A database that errors on every read, as if the table were missing. */
	function brokenDb() {
		const chain: Record<string, unknown> = {};
		Object.assign(chain, {
			select: () => chain,
			gte: () => chain,
			eq: () => chain,
			insert: () => Promise.resolve({ error: { message: 'relation does not exist' } }),
			then: (resolve: (r: { count: null; error: { message: string } }) => void) =>
				resolve({ count: null, error: { message: 'relation does not exist' } }),
		});
		return { from: () => chain } as never;
	}

	it('allows a normal submission and records it', async () => {
		const { db, inserted } = fakeDb();
		await expect(assertFormSubmitAllowed(db, req('1.1.1.1'), 'contact')).resolves
			.toBeUndefined();
		expect(inserted).toHaveLength(1);
		expect(inserted[0].form).toBe('contact');
	});

	it('does not store the raw IP address', async () => {
		const { db, inserted } = fakeDb();
		await assertFormSubmitAllowed(db, req('203.0.113.7'), 'contact');
		expect(inserted[0].ip_hash).not.toContain('203.0.113.7');
		expect(inserted[0].ip_hash).toMatch(/^[0-9a-f]{32}$/);
	});

	it('rejects once this source is already at the hourly limit', async () => {
		const { db: probe, inserted } = fakeDb();
		await assertFormSubmitAllowed(probe, req('2.2.2.2'), 'contact');
		const hash = inserted[0].ip_hash;

		__resetFormRateLimits();
		const { db } = fakeDb({ [hash]: __limits.PER_IP_PER_HOUR });
		await expect(
			assertFormSubmitAllowed(db, req('2.2.2.2'), 'contact'),
		).rejects.toThrow(/Too many messages/);
	});

	it('rejects with 429, not 500', async () => {
		const { db: probe, inserted } = fakeDb();
		await assertFormSubmitAllowed(probe, req('3.3.3.3'), 'contact');
		const hash = inserted[0].ip_hash;

		__resetFormRateLimits();
		const { db } = fakeDb({ [hash]: __limits.PER_IP_PER_DAY });
		await assertFormSubmitAllowed(db, req('3.3.3.3'), 'contact').then(
			() => {
				throw new Error('should have thrown');
			},
			(err: { status?: number }) => expect(err.status).toBe(429),
		);
	});

	it('shares the limit across instances, which in-memory counters did not', async () => {
		// The bug this replaced: four posts to production were served by four
		// lambdas and none saw the others. A shared count has no such gap, so a
		// fresh instance with an empty memory bucket is still rejected.
		const { db: probe, inserted } = fakeDb();
		await assertFormSubmitAllowed(probe, req('4.4.4.4'), 'contact');
		const hash = inserted[0].ip_hash;

		__resetFormRateLimits(); // simulates a cold lambda
		const { db } = fakeDb({ [hash]: __limits.PER_IP_PER_HOUR });
		await expect(
			assertFormSubmitAllowed(db, req('4.4.4.4'), 'audit-enquiry'),
		).rejects.toThrow(/Too many messages/);
	});

	it('caps total sends so a distributed flood cannot drain the daily quota', async () => {
		const { db } = fakeDb({}, __limits.GLOBAL_PER_HOUR);
		await expect(
			assertFormSubmitAllowed(db, req('5.5.5.5'), 'contact'),
		).rejects.toThrow(/Too many messages/);
	});

	it('does not punish an unrelated visitor for someone else flooding', async () => {
		const { db } = fakeDb({ someoneelseshash: 99 }, 0);
		await expect(
			assertFormSubmitAllowed(db, req('6.6.6.6'), 'contact'),
		).resolves.toBeUndefined();
	});

	it('fails OPEN when the table is missing, rather than taking the form down', async () => {
		// A customer who cannot reach the contact form is worse than a flood
		// that gets through, and the in-memory layer still applies.
		await expect(
			assertFormSubmitAllowed(brokenDb(), req('7.7.7.7'), 'contact'),
		).resolves.toBeUndefined();
	});
});
