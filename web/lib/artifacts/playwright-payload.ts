import type { ScanResult } from '@/lib/scan/types/scan.types';
import { buildProgrammaticRollup } from '@/lib/scan/utils/programmaticSummary';
import type { RawPageArtifact } from './types';

export function buildPlaywrightPayloadFromArtifact(artifact: RawPageArtifact) {
	const programmaticRollup = buildProgrammaticRollup(
		artifact.brokenStates as ScanResult['brokenStates'],
	);

	const payload = {
		playwrightDataVersion: 3 as const,
		links: artifact.links ?? null,
		interactive: artifact.interactive ?? null,
		consoleMessages: artifact.diagnostics.consoleMessages ?? [],
		failedRequests: artifact.diagnostics.failedRequests ?? [],
		httpErrors: artifact.diagnostics.httpErrors ?? [],
		seoData: artifact.seo ?? null,
		steps: artifact.diagnostics.steps ?? [],
		warnings: artifact.diagnostics.warnings ?? [],
		brokenStates: artifact.brokenStates ?? null,
		programmaticRollup,
		responseSecurity: artifact.responseSecurity ?? null,
		responsive: artifact.responsive ?? null,
		axeViolations: artifact.accessibility ?? null,
	};

	if (artifact.scanOk) {
		return { ...payload, scanOk: true as const };
	}

	return {
		...payload,
		scanOk: false as const,
		error: artifact.diagnostics.error ?? artifact.reason ?? 'scan_failed',
	};
}

/** Minimal DB summary — full data lives in artifact storage. */
export function buildPlaywrightIndexPayload(scanOk: boolean) {
	return {
		playwrightDataVersion: 3 as const,
		scanOk,
	};
}
