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




// ─── Form field building blocks ───────────────────────────────────────────────
/**
 * A value that will end up on one line of an email — and in some cases inside
 * the Subject header. Headers are newline-delimited, so a CR or LF in one of
 * these can terminate the header early and start another: the classic way a
 * contact form becomes an open relay for someone else's Bcc.
 *
 * Rejected at the boundary here, and scrubbed again by headerSafe() where the
 * value is actually used, so a future field that forgets this rule still
 * cannot break a header.
 *
 * Note what this deliberately does NOT do: it does not reject angle brackets,
 * quotes, braces or SQL-looking text. Those are neutralised by escaping at the
 * point of output, and blocking them here would reject real messages. This
 * product sells website bug reports — "the nav shows a raw <div> on mobile" is
 * a customer describing their actual problem, and a pattern blocklist would
 * throw that away while stopping nothing that escaping does not already stop.
 */
const SINGLE_LINE = /^[^\u0000-\u001F\u007F]*$/;
const singleLine = (max: number, label: string) =>
	z.string().trim().max(max).regex(SINGLE_LINE, `${label} cannot contain line breaks.`);

/**
 * Honeypot. Hidden from people, irresistible to the form-filling bots that
 * arrive after a post does numbers. A real submission always leaves it empty;
 * anything else is discarded without telling the sender why, since a precise
 * error is just feedback for tuning the next attempt.
 */
const honeypot = z.string().max(200).optional();

// ─── Contact form ─────────────────────────────────────────────────────────────
// Shared by the contact form (client-side validation) and the
// POST /api/contact route handler (server-side validation), so the rules can
// never drift between the two. Required fields mirror the form's "*" markers:
// first name, last name, and a valid email. Everything else is optional.
export const contactFormSchema = z.object({
	// firstName and lastName are joined into the Subject line, so both are
	// single-line.
	firstName: singleLine(80, 'First name').min(1, 'First name is required.'),
	lastName: singleLine(80, 'Last name').min(1, 'Last name is required.'),
	email: z
		.string()
		.trim()
		.min(1, 'Email is required.')
		.email('Enter a valid email address.')
		.max(160),
	// Optional context fields. Empty strings are allowed (treated as "not
	// provided"); only a max length is enforced to guard against abuse.
	websiteUrl: singleLine(300, 'Website').optional(),
	pageCount: singleLine(80, 'Page count').optional(),
	websiteType: singleLine(80, 'Website type').optional(),
	message: z.string().trim().max(4000).optional(),
	company: honeypot,
});

/**
 * Enquiry for the done-for-you manual audit offered on the result page.
 *
 * The website is not collected from the visitor — it comes from the scan they
 * are already looking at, so the form only asks for what we cannot infer.
 * WhatsApp is optional: many small-business owners prefer it to email.
 */
export const auditEnquirySchema = z.object({
	name: singleLine(120, 'Name').min(1, 'Name is required.'),
	email: z
		.string()
		.trim()
		.min(1, 'Email is required.')
		.email('Enter a valid email address.')
		.max(160),
	whatsapp: singleLine(40, 'WhatsApp number').optional(),
	/** Filled in by the page from the scan being viewed. Reaches the Subject. */
	websiteUrl: singleLine(300, 'Website').optional(),
	scanId: singleLine(64, 'Scan ID').optional(),
	/** Free-text: what they are most worried about. */
	concern: z.string().trim().max(2000).optional(),
	company: honeypot,
});

export type ScanPackage = z.infer<typeof scanPackageSchema>;
export type WebsiteType = z.infer<typeof websiteTypeSchema>;
export type ScanStatus = z.infer<typeof scanStatusSchema>;
export type ContactFormData = z.infer<typeof contactFormSchema>;
export type AuditEnquiryData = z.infer<typeof auditEnquirySchema>;

