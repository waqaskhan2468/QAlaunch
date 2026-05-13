import type { DetectionResult } from '@/utils/detect';
import type { SelectedScanPage } from '@/utils/page-selection';

export type DetectAndSelectResult = {
	detection: DetectionResult;
	pagesToTest: string[];
	selectedPages: SelectedScanPage[];
};

/** Subset of `scans` row returned after PageSpeed + scanner steps. */
export type ScanRowAfterReload = {
	status: string | null;
	website_type: string | null;
	pages_to_test: unknown;
	package: string | null;
};
