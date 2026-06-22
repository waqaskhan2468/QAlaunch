import type { ScanResult } from '@/lib/scan/types/scan.types';
import { buildProgrammaticRollup } from '@/lib/scan/utils/programmaticSummary';

type ResponsiveScanMeta = {
	viewport: string;
	width: number;
	height: number;
	hasHorizontalScroll: boolean;
	sliceCount?: number;
};

function responsiveToScanMeta(
	responsive: ScanResult['responsive'],
): ResponsiveScanMeta[] | null {
	if (!responsive?.length) return null;
	return responsive.map(({ screenshot: _s, slices: _sl, ...meta }) => meta);
}

/**
 * Full payload stored in scan_pages.playwright_data (v4).
 * Field names match what buildAnalysisPromptAfterImages() reads.
 */
export function buildPlaywrightPayloadFromScanResult(result: ScanResult) {
	const programmaticRollup = buildProgrammaticRollup(result.brokenStates);

	const payload = {
		playwrightDataVersion: 4 as const,
		links: result.links ?? null,
		interactive: result.interactive ?? null,
		consoleMessages: result.consoleMessages ?? [],
		failedRequests: result.failedRequests ?? [],
		httpErrors: result.httpErrors ?? [],
		seoData: result.seoData ?? null,
		steps: result.steps ?? [],
		warnings: result.warnings ?? [],
		brokenStates: result.brokenStates ?? null,
		programmaticRollup,
		responseSecurity: result.responseSecurityMeta ?? null,
		responsive: responsiveToScanMeta(result.responsive),
		axeViolations: result.axe ?? null,
		interactionTests: result.interactionTests ?? null,
		interactionProbes: result.interactionProbes ?? null,
		patternChecks: result.patternChecks ?? null,
	};

	if (result.ok) {
		return { ...payload, scanOk: true as const };
	}

	return {
		...payload,
		scanOk: false as const,
		error: result.error ?? 'scan_failed',
	};
}

/** Minimal payload for pages that failed after Inngest retries. */
export function buildPlaywrightIndexPayload(scanOk: boolean) {
	return {
		playwrightDataVersion: 3 as const,
		scanOk,
	};
}
