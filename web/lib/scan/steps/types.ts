import type { DetectionResult } from '@/lib/utils/detect';
import type { SelectedScanPage } from '@/lib/utils/page-selection';

export type DetectAndSelectResult = {
	detection: DetectionResult;
	pagesToTest: string[];
	selectedPages: SelectedScanPage[];
};

/** Returned from the per-page browser Inngest step. */
export type PageBrowserStepResult = {
	scanId: string;
	pageUrl: string;
	scanOk: boolean;
	screenshotDesktopUrl: string | null;
	screenshotMobileUrl: string | null;
};

/** Subset of `scans` row returned after PageSpeed + scanner steps. */
export type ScanRowAfterReload = {
	status: string | null;
	website_type: string | null;
	pages_to_test: unknown;
	package: string | null;
};
