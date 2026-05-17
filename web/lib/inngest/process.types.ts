import type { ScanPackage } from '@/types/zod';

export type ProcessPayload = {
	scanId: string;
	package: ScanPackage;
	targetUrl: string;
	userEmail?: string | null;
};
