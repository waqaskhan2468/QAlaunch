import { describe, it, expect } from 'vitest';

import { auditEnquirySchema } from '@/types/zod';

/**
 * Validation for the $299 manual-audit enquiry.
 *
 * This is the highest-value lead the site produces, so the rules lean towards
 * letting a message through: only name and email are required, because a
 * rejected form is a lost $299 enquiry while a sparse one is just a short reply.
 */

const valid = {
	name: 'Sara Ahmed',
	email: 'sara@example.com',
};

describe('auditEnquirySchema', () => {
	it('accepts the minimum a real person would type', () => {
		expect(auditEnquirySchema.safeParse(valid).success).toBe(true);
	});

	it('accepts the full form including the optional WhatsApp number', () => {
		const parsed = auditEnquirySchema.safeParse({
			...valid,
			whatsapp: '+92 300 1234567',
			websiteUrl: 'https://shop.com/',
			scanId: 'abc-123',
			concern: 'Not sure my checkout works on phones',
		});
		expect(parsed.success).toBe(true);
	});

	it('does not require WhatsApp — it is optional on the form', () => {
		const parsed = auditEnquirySchema.safeParse({ ...valid, whatsapp: undefined });
		expect(parsed.success).toBe(true);
	});

	it.each([
		['missing name', { email: 'a@b.com' }],
		['empty name', { name: '   ', email: 'a@b.com' }],
		['missing email', { name: 'Sara' }],
		['malformed email', { name: 'Sara', email: 'not-an-email' }],
	])('rejects %s', (_label, input) => {
		expect(auditEnquirySchema.safeParse(input).success).toBe(false);
	});

	it('trims whitespace so the alert email reads cleanly', () => {
		const parsed = auditEnquirySchema.parse({
			name: '  Sara Ahmed  ',
			email: '  sara@example.com  ',
		});
		expect(parsed.name).toBe('Sara Ahmed');
		expect(parsed.email).toBe('sara@example.com');
	});

	it('caps field lengths so the form cannot be used to send bulk text', () => {
		expect(
			auditEnquirySchema.safeParse({ ...valid, concern: 'x'.repeat(2001) }).success,
		).toBe(false);
		expect(auditEnquirySchema.safeParse({ ...valid, name: 'x'.repeat(121) }).success).toBe(
			false,
		);
	});
});
