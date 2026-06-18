import { z } from 'zod';

export const scanPackageSchema = z.enum([
	'free',
	'basic',
	'standard',
	'premium',
	'enterprise',
]);
export const websiteTypeSchema = z.enum([
	'ecommerce',
	'business',
	'saas',
	'blog',
	'portfolio',
	'webapp',
	'landing',
	'freelancer',
	'agency',
	'restaurant',
	'nonprofit',
	'event',
	'directory',
	'unknown',
]);
export const scanStatusSchema = z.enum([
	'pending',
	'crawling',
	'analyzing',
	'done',
	'failed',
]);

export const scanStartSchema = z
	.object({
		url: z.string().min(1),
		email: z.string().optional(),
		package: scanPackageSchema,
		/**
		 * Set by the client when the user confirms the "we test public pages
		 * only" interstitial for a web-app/auth homepage. Skips the gate's
		 * confirmation prompt on the second submit. Paid packages only.
		 */
		acknowledgePublicOnly: z.boolean().optional(),
	})
	.superRefine((data, ctx) => {
		const emailTrim =
			typeof data.email === 'string' ? data.email.trim() : '';

		if (data.package === 'free') {
			if (emailTrim && !z.string().email().safeParse(emailTrim).success) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Enter a valid email address.',
					path: ['email'],
				});
			}
			return;
		}

		if (!emailTrim) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'Email is required.',
				path: ['email'],
			});
			return;
		}
		if (!z.string().email().safeParse(emailTrim).success) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'Enter a valid email address.',
				path: ['email'],
			});
		}
	});




// ─── Contact form ─────────────────────────────────────────────────────────────
// Shared by the contact form (client-side validation) and the
// POST /api/contact route handler (server-side validation), so the rules can
// never drift between the two. Required fields mirror the form's "*" markers:
// first name, last name, and a valid email. Everything else is optional.
export const contactFormSchema = z.object({
	firstName: z.string().trim().min(1, 'First name is required.').max(80),
	lastName: z.string().trim().min(1, 'Last name is required.').max(80),
	email: z
		.string()
		.trim()
		.min(1, 'Email is required.')
		.email('Enter a valid email address.')
		.max(160),
	// Optional context fields. Empty strings are allowed (treated as "not
	// provided"); only a max length is enforced to guard against abuse.
	websiteUrl: z.string().trim().max(300).optional(),
	pageCount: z.string().trim().max(80).optional(),
	websiteType: z.string().trim().max(80).optional(),
	message: z.string().trim().max(4000).optional(),
});

export type ScanPackage = z.infer<typeof scanPackageSchema>;
export type WebsiteType = z.infer<typeof websiteTypeSchema>;
export type ScanStatus = z.infer<typeof scanStatusSchema>;
export type ContactFormData = z.infer<typeof contactFormSchema>;

