import { getServiceSupabase } from '@/lib/db/supabase';
import { isRetryableNetworkError, updateScanPageRecord } from '@/lib/db/supabase-retry';
import { withRetry } from '@/lib/scan/services/retry';
import type { ScanResult } from '@/lib/scan/types/scan.types';
import {
	compressScreenshotBuffer,
	type ImageCompressionProfile,
} from '@/lib/scan/utils/imageCompression';
import { buildPlaywrightIndexPayload } from './playwright-payload';
import {
	pageArtifactJsonPath,
	pageArtifactSlicePath,
	pageDesktopScreenshotPath,
	pageMobileScreenshotPath,
} from './paths';
import { scanResultToArtifact } from './serialize';
import type {
	ArtifactSliceName,
	PageBrowserStepResult,
	RawPageArtifact,
} from './types';
import { getArtifactBucket, getScreenshotBucket } from './upload';

const UPLOAD_ATTEMPTS = 5;
const UPLOAD_DELAY_MS = 2_000;

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : 'unknown_error';
}

function shouldRetryUpload(error: unknown): boolean {
	return isRetryableNetworkError(error);
}

/** Upload to the PRIVATE artifact bucket (JSON slices, artifact.json). */
async function uploadBytes(
	path: string,
	buffer: Buffer,
	contentType: string,
): Promise<void> {
	await withRetry(
		async () => {
			const supabase = getServiceSupabase();
			const { error } = await supabase.storage
				.from(getArtifactBucket())
				.upload(path, buffer, { contentType, upsert: true });
			if (error) throw new Error(error.message);
		},
		{
			attempts: UPLOAD_ATTEMPTS,
			delayMs: UPLOAD_DELAY_MS,
			shouldRetry: shouldRetryUpload,
		},
	);
}

/**
 * Upload to the PUBLIC screenshot bucket and return the permanent public URL.
 * Because scan-screenshots is public, getPublicUrl() is stable — no signing needed.
 */
async function uploadScreenshotBytes(
	path: string,
	buffer: Buffer,
	contentType: string,
): Promise<string> {
	await withRetry(
		async () => {
			const supabase = getServiceSupabase();
			const { error } = await supabase.storage
				.from(getScreenshotBucket())
				.upload(path, buffer, { contentType, upsert: true });
			if (error) throw new Error(error.message);
		},
		{
			attempts: UPLOAD_ATTEMPTS,
			delayMs: UPLOAD_DELAY_MS,
			shouldRetry: shouldRetryUpload,
		},
	);
	const supabase = getServiceSupabase();
	const { data } = supabase.storage.from(getScreenshotBucket()).getPublicUrl(path);
	return data.publicUrl;
}

/**
 * Flush collector output to Storage as it completes so late failures
 * (screenshots, upload) do not discard earlier work.
 */
export class IncrementalArtifactWriter {
	private readonly startedAt = new Date().toISOString();
	private readonly artifactPath: string;
	private readonly flushedSlices = new Set<ArtifactSliceName>();
	private checkpointWritten = false;

	private screenshotPaths = {
		desktopPath: null as string | null,
		mobilePath: null as string | null,
		desktopPublicUrl: null as string | null,
		mobilePublicUrl: null as string | null,
	};

	private sliceData: Partial<Record<ArtifactSliceName, unknown>> = {};

	constructor(
		private readonly scanId: string,
		private readonly pageUrl: string,
	) {
		this.artifactPath = pageArtifactJsonPath(scanId, pageUrl);
	}

	async flushSlice(name: ArtifactSliceName, data: unknown): Promise<void> {
		if (data === undefined) return;

		try {
			const path = pageArtifactSlicePath(this.scanId, this.pageUrl, name);
			const body = Buffer.from(JSON.stringify(data), 'utf-8');
			await uploadBytes(path, body, 'application/json');
			this.flushedSlices.add(name);
			this.sliceData[name] = data;
			await this.maybeWriteCheckpoint();
		} catch (error) {
			console.warn('[artifacts] incremental slice flush failed', {
				scanId: this.scanId,
				pageUrl: this.pageUrl,
				slice: name,
				error: getErrorMessage(error),
			});
		}
	}

	async uploadScreenshot(
		label: 'desktop' | 'mobile',
		screenshot: Buffer,
	): Promise<void> {
		if (!screenshot?.length) return;

		try {
			const profile: ImageCompressionProfile =
				label === 'desktop' ? 'desktop' : 'responsive';

			let uploadBuffer = screenshot;
			let contentType: 'image/png' | 'image/jpeg' = 'image/png';
			let extension: 'png' | 'jpg' = 'png';

			try {
				const optimized = await compressScreenshotBuffer(screenshot, profile);
				uploadBuffer = optimized.buffer;
				contentType = optimized.contentType;
				extension = optimized.extension;
			} catch (error) {
				console.warn('[artifacts] screenshot compression skipped', {
					label,
					pageUrl: this.pageUrl,
					error: getErrorMessage(error),
				});
			}

			const path =
				label === 'desktop' ?
					pageDesktopScreenshotPath(this.scanId, this.pageUrl, extension)
				:	pageMobileScreenshotPath(this.scanId, this.pageUrl, extension);

			const publicUrl = await uploadScreenshotBytes(path, uploadBuffer, contentType);

			if (label === 'desktop') {
				this.screenshotPaths.desktopPath = path;
				this.screenshotPaths.desktopPublicUrl = publicUrl;
			} else {
				this.screenshotPaths.mobilePath = path;
				this.screenshotPaths.mobilePublicUrl = publicUrl;
			}

			await this.maybeWriteCheckpoint();
		} catch (error) {
			console.warn('[artifacts] incremental screenshot upload failed', {
				scanId: this.scanId,
				pageUrl: this.pageUrl,
				label,
				error: getErrorMessage(error),
			});
		}
	}

	async finalize(result: ScanResult): Promise<PageBrowserStepResult> {
		const finishedAt = new Date().toISOString();
		const artifact = scanResultToArtifact(result, {
			startedAt: this.startedAt,
			finishedAt,
			screenshotPaths: this.screenshotPaths,
		});

		await this.uploadArtifactJson(artifact);

		return {
			scanId: this.scanId,
			pageUrl: this.pageUrl,
			artifactPath: this.artifactPath,
			artifactStatus: artifact.status,
			scanOk: artifact.scanOk,
			screenshotDesktopUrl: this.screenshotPaths.desktopPublicUrl,
			screenshotMobileUrl: this.screenshotPaths.mobilePublicUrl,
		};
	}

	async finalizePartial(error: unknown): Promise<PageBrowserStepResult | null> {
		if (this.flushedSlices.size === 0 && !this.screenshotPaths.desktopPath) {
			return null;
		}

		const finishedAt = new Date().toISOString();
		const message = getErrorMessage(error);

		const artifact: RawPageArtifact = {
			version: 1,
			scanId: this.scanId,
			pageUrl: this.pageUrl,
			status: 'partial',
			reason: message,
			scanOk: false,
			timings: {
				startedAt: this.startedAt,
				finishedAt,
				durationMs:
					new Date(finishedAt).getTime() - new Date(this.startedAt).getTime(),
			},
			screenshots: this.screenshotPaths,
			accessibility: (this.sliceData.accessibility as unknown) ?? null,
			seo: (this.sliceData.seo as unknown) ?? null,
			links: (this.sliceData.links as unknown) ?? null,
			interactive: (this.sliceData.interactive as unknown) ?? null,
			brokenStates: (this.sliceData.broken_states as unknown) ?? null,
			responseSecurity: (this.sliceData.response_security as unknown) ?? null,
			responsive:
				(this.sliceData.responsive as RawPageArtifact['responsive']) ?? null,
			diagnostics: {
				steps: [],
				warnings: [`scan_aborted: ${message}`],
				consoleMessages: [],
				failedRequests: [],
				httpErrors: [],
				error: message,
			},
		};

		try {
			await this.uploadArtifactJson(artifact);
		} catch (uploadError) {
			console.warn('[artifacts] partial artifact upload failed', {
				scanId: this.scanId,
				pageUrl: this.pageUrl,
				error: getErrorMessage(uploadError),
			});
			return null;
		}

		return {
			scanId: this.scanId,
			pageUrl: this.pageUrl,
			artifactPath: this.artifactPath,
			artifactStatus: 'partial',
			scanOk: false,
			screenshotDesktopUrl: this.screenshotPaths.desktopPublicUrl,
			screenshotMobileUrl: this.screenshotPaths.mobilePublicUrl,
		};
	}

	private async uploadArtifactJson(artifact: RawPageArtifact): Promise<void> {
		const jsonBody = Buffer.from(JSON.stringify(artifact), 'utf-8');
		await uploadBytes(this.artifactPath, jsonBody, 'application/json');
	}

	private async maybeWriteCheckpoint(): Promise<void> {
		if (this.checkpointWritten) return;
		if (this.flushedSlices.size === 0 && !this.screenshotPaths.desktopPath) {
			return;
		}

		try {
			await updateScanPageRecord(this.scanId, this.pageUrl, {
				artifact_path: this.artifactPath,
				artifact_status: 'partial',
				screenshot_desktop_url: this.screenshotPaths.desktopPublicUrl,
				screenshot_mobile_url: this.screenshotPaths.mobilePublicUrl,
				playwright_data: buildPlaywrightIndexPayload(false),
				raw_html: null,
				axe_violations: null,
			});
			this.checkpointWritten = true;
		} catch (error) {
			console.warn('[artifacts] partial DB checkpoint failed', {
				scanId: this.scanId,
				pageUrl: this.pageUrl,
				error: getErrorMessage(error),
			});
		}
	}
}
