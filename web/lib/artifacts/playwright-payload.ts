import type { ScanResult } from '@/lib/scan/types/scan.types';
import { buildProgrammaticRollup } from '@/lib/scan/utils/programmaticSummary';
import { responsiveToArtifactMeta } from './serialize';

/**
 * Build the full playwright payload directly from a ScanResult.
 *
 * Version 4 — stored in scan_pages.playwright_data JSONB and read by the AI analysis step.
 * Field names match exactly what buildAnalysisPromptAfterImages() reads from playwrightData.
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
		responsive: responsiveToArtifactMeta(result.responsive),
		axeViolations: result.axe ?? null,
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

/** Minimal index payload — used for failed-page records in persistFailedPageIndex. */
export function buildPlaywrightIndexPayload(scanOk: boolean) {
	return {
		playwrightDataVersion: 3 as const,
		scanOk,
	};
}
