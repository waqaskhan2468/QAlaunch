function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

/** True when Google PSI mobile/desktop strategy has scores or opportunities. */
export function hasPageSpeedData(pageSpeedData: unknown): boolean {
	if (!isRecord(pageSpeedData)) return false;

	for (const key of ['mobile', 'desktop'] as const) {
		const strategy = pageSpeedData[key];
		if (!isRecord(strategy)) continue;
		if (typeof strategy.performance === 'number') return true;
		if (
			Array.isArray(strategy.opportunities) &&
			strategy.opportunities.length > 0
		) {
			return true;
		}
	}

	return false;
}

/** True when artifact / legacy playwright payload has analyzable structured data. */
export function hasStructuredScanData(scanData: unknown): boolean {
	if (!isRecord(scanData)) return false;

	const axe = scanData.axeViolations ?? scanData.axe;
	if (Array.isArray(axe) && axe.length > 0) return true;

	if (isRecord(scanData.seoData) && Object.keys(scanData.seoData).length > 0) {
		return true;
	}

	const links = scanData.links;
	if (isRecord(links)) {
		if (Array.isArray(links.links) && links.links.length > 0) return true;
		if (Array.isArray(links.brokenLinks) && links.brokenLinks.length > 0) {
			return true;
		}
	}

	if (Array.isArray(scanData.brokenStates) && scanData.brokenStates.length > 0) {
		return true;
	}

	if (
		Array.isArray(scanData.consoleMessages) &&
		scanData.consoleMessages.length > 0
	) {
		return true;
	}

	if (Array.isArray(scanData.httpErrors) && scanData.httpErrors.length > 0) {
		return true;
	}

	if (
		Array.isArray(scanData.failedRequests) &&
		scanData.failedRequests.length > 0
	) {
		return true;
	}

	if (isRecord(scanData.interactive) && Object.keys(scanData.interactive).length > 0) {
		return true;
	}

	return false;
}

export function pageHasAnalyzableData(input: {
	pageSpeedData: unknown;
	scanData: unknown;
}): boolean {
	return (
		hasPageSpeedData(input.pageSpeedData) ||
		hasStructuredScanData(input.scanData)
	);
}

export type AiAnalysisMode = 'full' | 'hybrid' | 'text_only';

export function resolveAiAnalysisMode(input: {
	hasDesktop: boolean;
	hasMobile: boolean;
}): AiAnalysisMode {
	if (input.hasDesktop && input.hasMobile) return 'full';
	if (input.hasDesktop || input.hasMobile) return 'hybrid';
	return 'text_only';
}
