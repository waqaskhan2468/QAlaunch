import { NonRetriableError } from 'inngest';
import { fetchHomepageHtml } from '@/lib/api/fetchHomePageHtml';
import { detectWebsiteType } from '@/utils/detect';
import {
	selectPagesToTestWithRoles,
	type SelectedScanPage,
} from '@/utils/page-selection';
import type { ScanPackage } from '@/types/zod';
import type { DetectAndSelectResult } from './types';

export async function detectAndSelectPagesStep(
	targetUrl: string,
	pkg: ScanPackage,
): Promise<DetectAndSelectResult> {
	const homepageHtml = await fetchHomepageHtml(targetUrl);
	const detection = detectWebsiteType(homepageHtml, targetUrl);
	const selectedPages = selectPagesToTestWithRoles(
		homepageHtml,
		targetUrl,
		detection.type,
		pkg,
	);
	const pagesToTest = selectedPages.map((p: SelectedScanPage) => p.url);

	if (!pagesToTest.length) {
		throw new NonRetriableError(
			'No public pages were found to test on this website.',
		);
	}

	return { detection, pagesToTest, selectedPages };
}
