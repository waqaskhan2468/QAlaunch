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

export const scanStartSchema = z.object({
	url: z.string().min(1),
	email: z.string().email().optional().or(z.literal('')).optional(),
	package: scanPackageSchema,
});




export type ScanPackage = z.infer<typeof scanPackageSchema>;
export type WebsiteType = z.infer<typeof websiteTypeSchema>;
export type ScanStatus = z.infer<typeof scanStatusSchema>;

