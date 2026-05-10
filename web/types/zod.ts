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




export type ScanPackage = z.infer<typeof scanPackageSchema>;
export type WebsiteType = z.infer<typeof websiteTypeSchema>;
export type ScanStatus = z.infer<typeof scanStatusSchema>;

