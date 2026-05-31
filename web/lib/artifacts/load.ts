/**
 * Resolve the scan data for a page row.
 *
 * New scans (playwrightDataVersion 4): playwright_data holds the complete payload —
 * returned directly without any Storage download.
 *
 * Fallback: return playwright_data as-is (old v3 minimal index or null).
 */
export async function resolvePageScanData(row: {
	playwright_data?: unknown;
}) {
	return row.playwright_data ?? null;
}

export async function hydratePagesWithArtifacts(
	pages: Array<{
		playwright_data?: unknown;
		[key: string]: unknown;
	}>,
) {
	return Promise.all(
		pages.map(async (page) => ({
			...page,
			resolvedPlaywrightData: await resolvePageScanData(page),
		})),
	);
}
