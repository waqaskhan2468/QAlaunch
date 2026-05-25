import type { ScanResult } from '@/lib/scan/types/scan.types';
import type {
	PageArtifactStatus,
	RawPageArtifact,
	ResponsiveArtifactMeta,
} from './types';

function deriveArtifactStatus(result: ScanResult): PageArtifactStatus {
	if (result.ok) return 'ok';

	const hasNavigation = result.steps.some(
		(step) => step.name.startsWith('navigate') && step.ok,
	);
	const hasScreenshots =
		Boolean(result.screenshots?.desktop) ||
		Boolean(result.screenshots?.mobile);
	const hasCollectorData =
		Boolean(result.seoData) ||
		Boolean(result.links) ||
		Boolean(result.axe) ||
		Boolean(result.interactive) ||
		Boolean(result.brokenStates);

	if (hasNavigation || hasScreenshots || hasCollectorData) return 'partial';
	return 'failed';
}

export function responsiveToArtifactMeta(
	responsive: ScanResult['responsive'],
): ResponsiveArtifactMeta[] | null {
	if (!responsive?.length) return null;
	return responsive.map(({ screenshot: _s, slices: _sl, ...meta }) => meta);
}

export function scanResultToArtifact(
	result: ScanResult,
	input: {
		startedAt: string;
		finishedAt: string;
		screenshotPaths: {
			desktopPath: string | null;
			mobilePath: string | null;
			desktopPublicUrl: string | null;
			mobilePublicUrl: string | null;
		};
	},
): RawPageArtifact {
	const status = deriveArtifactStatus(result);

	return {
		version: 1,
		scanId: result.scanId,
		pageUrl: result.url,
		status,
		reason: result.error,
		scanOk: result.ok,
		timings: {
			startedAt: input.startedAt,
			finishedAt: input.finishedAt,
			durationMs:
				new Date(input.finishedAt).getTime() -
				new Date(input.startedAt).getTime(),
		},
		screenshots: input.screenshotPaths,
		accessibility: result.axe ?? null,
		seo: result.seoData ?? null,
		links: result.links ?? null,
		interactive: result.interactive ?? null,
		brokenStates: result.brokenStates ?? null,
		responseSecurity: result.responseSecurityMeta ?? null,
		responsive: responsiveToArtifactMeta(result.responsive),
		diagnostics: {
			steps: result.steps,
			warnings: result.warnings,
			consoleMessages: result.consoleMessages,
			failedRequests: result.failedRequests,
			httpErrors: result.httpErrors,
			...(result.error ? { error: result.error } : {}),
		},
	};
}
