import type { ScanPackage } from '@/types/zod';

export type ProcessPayload = {
	scanId: string;
	package: ScanPackage;
	targetUrl: string;
	userEmail?: string | null;
	/**
	 * The free scan this paid order was placed from, when there was one. Its
	 * findings are inherited into the paid report so nothing the buyer saw
	 * locked can go missing. Absent for free scans and direct purchases.
	 */
	sourceScanId?: string | null;
};
