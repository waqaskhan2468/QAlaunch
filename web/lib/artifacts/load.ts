import { getServiceSupabase } from '@/lib/db/supabase';
import { withRetry } from '@/lib/scan/services/retry';
import { isRetryableNetworkError } from '@/lib/db/supabase-retry';
import { buildPlaywrightPayloadFromArtifact } from './playwright-payload';
import { pageArtifactSlicePath } from './paths';
import { getArtifactBucket } from './upload';
import type { ArtifactSliceName, RawPageArtifact } from './types';

function shouldRetryDownload(error: unknown): boolean {
	return isRetryableNetworkError(error);
}

async function downloadStorageText(path: string): Promise<string> {
	return withRetry(
		async () => {
			const supabase = getServiceSupabase();
			const { data, error } = await supabase.storage
				.from(getArtifactBucket())
				.download(path);

			if (error || !data) {
				throw new Error(error?.message ?? 'artifact_download_failed');
			}

			return data.text();
		},
		{
			attempts: 5,
			delayMs: 2_000,
			shouldRetry: shouldRetryDownload,
		},
	);
}

async function tryLoadSlice(
	scanId: string,
	pageUrl: string,
	name: ArtifactSliceName,
): Promise<unknown | null> {
	try {
		const body = await downloadStorageText(
			pageArtifactSlicePath(scanId, pageUrl, name),
		);
		return JSON.parse(body) as unknown;
	} catch {
		return null;
	}
}

async function loadArtifactFromSlicesForPage(
	scanId: string,
	pageUrl: string,
): Promise<RawPageArtifact | null> {
	const [seo, links, interactive, broken_states, accessibility, responsive] =
		await Promise.all([
			tryLoadSlice(scanId, pageUrl, 'seo'),
			tryLoadSlice(scanId, pageUrl, 'links'),
			tryLoadSlice(scanId, pageUrl, 'interactive'),
			tryLoadSlice(scanId, pageUrl, 'broken_states'),
			tryLoadSlice(scanId, pageUrl, 'accessibility'),
			tryLoadSlice(scanId, pageUrl, 'responsive'),
		]);

	const hasData =
		seo ||
		links ||
		interactive ||
		broken_states ||
		accessibility ||
		responsive;

	if (!hasData) return null;

	const now = new Date().toISOString();
	return {
		version: 1,
		scanId,
		pageUrl,
		status: 'partial',
		scanOk: false,
		timings: { startedAt: now, finishedAt: now, durationMs: 0 },
		screenshots: {
			desktopPath: null,
			mobilePath: null,
			desktopPublicUrl: null,
			mobilePublicUrl: null,
		},
		accessibility,
		seo,
		links,
		interactive,
		brokenStates: broken_states,
		responseSecurity: null,
		responsive: responsive as RawPageArtifact['responsive'],
		diagnostics: {
			steps: [],
			warnings: [],
			consoleMessages: [],
			failedRequests: [],
			httpErrors: [],
		},
	};
}

async function loadFullArtifact(
	artifactPath: string,
): Promise<RawPageArtifact | null> {
	try {
		const body = await downloadStorageText(artifactPath);
		return JSON.parse(body) as RawPageArtifact;
	} catch {
		return null;
	}
}

export async function resolvePageScanData(row: {
	scan_id: string;
	page_url: string;
	artifact_path?: string | null;
	playwright_data?: unknown;
	axe_violations?: unknown;
	seo_data?: unknown;
}) {
	if (row.artifact_path) {
		const artifact = await loadFullArtifact(row.artifact_path);
		if (artifact) {
			return buildPlaywrightPayloadFromArtifact(artifact);
		}
		// fallback to slices if full artifact missing
		const sliceBased = await loadArtifactFromSlicesForPage(
			row.scan_id,
			row.page_url,
		);
		if (sliceBased) {
			return buildPlaywrightPayloadFromArtifact(sliceBased);
		}
	}
	// Legacy DB columns fallback
	return row.playwright_data ?? null;
}

export async function hydratePagesWithArtifacts(
	pages: Array<{
		scan_id: string;
		page_url: string;
		artifact_path?: string | null;
		playwright_data?: unknown;
		axe_violations?: unknown;
		seo_data?: unknown;
	}>,
) {
	return Promise.all(
		pages.map(async (page) => ({
			...page,
			resolvedPlaywrightData: await resolvePageScanData(page),
		})),
	);
}
