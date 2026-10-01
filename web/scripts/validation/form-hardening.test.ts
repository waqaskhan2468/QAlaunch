import { describe, it, expect, beforeEach } from 'vitest';

import { escapeHtml, headerSafe } from '@/lib/api/email-safety';
import {
	assertFormSubmitAllowed,
	__resetFormRateLimits,
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

	it('allows a normal submission', () => {
		expect(() => assertFormSubmitAllowed(req('1.1.1.1'))).not.toThrow();
	});

	it('allows a person who retries after a typo', () => {
		expect(() => {
			assertFormSubmitAllowed(req('1.1.1.1'));
			assertFormSubmitAllowed(req('1.1.1.1'));
		}).not.toThrow();
	});

	it('cuts off a flood from one address', () => {
		for (let i = 0; i < 3; i += 1) assertFormSubmitAllowed(req('2.2.2.2'));
		expect(() => assertFormSubmitAllowed(req('2.2.2.2'))).toThrow(/Too many messages/);
	});

	it('answers 429, not 500, when it cuts someone off', () => {
		for (let i = 0; i < 3; i += 1) assertFormSubmitAllowed(req('3.3.3.3'));
		try {
			assertFormSubmitAllowed(req('3.3.3.3'));
			throw new Error('should have thrown');
		} catch (err) {
			expect((err as { status?: number }).status).toBe(429);
		}
	});

	it('does not punish an unrelated visitor for someone else flooding', () => {
		for (let i = 0; i < 3; i += 1) assertFormSubmitAllowed(req('4.4.4.4'));
		expect(() => assertFormSubmitAllowed(req('5.5.5.5'))).not.toThrow();
	});

	it('caps total sends so a distributed flood cannot drain the daily quota', () => {
		// 40/hour globally, well under the 100/day Resend plan that scan and
		// report email also draw from.
		let sent = 0;
		for (let i = 0; i < 200; i += 1) {
			try {
				assertFormSubmitAllowed(req(`10.0.${Math.floor(i / 250)}.${i % 250}`));
				sent += 1;
			} catch {
				/* expected once the global cap is reached */
			}
		}
		expect(sent).toBe(40);
	});
});
