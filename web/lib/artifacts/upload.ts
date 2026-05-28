import { getServiceSupabase } from '@/lib/db/supabase';
import { isRetryableNetworkError } from '@/lib/db/supabase-retry';
import { withRetry } from '@/lib/scan/services/retry';
import {
	compressScreenshotBuffer,
	type ImageCompressionProfile,
} from '@/lib/scan/utils/imageCompression';
import type { ScanResult } from '@/lib/scan/types/scan.types';
import {
	pageArtifactJsonPath,
	pageDesktopScreenshotPath,
	pageMobileScreenshotPath,
} from './paths';
import { scanResultToArtifact } from './serialize';
import type { PageBrowserStepResult } from './types';

/**
 * Bucket layout
 * ─────────────────────────────────────────────────────
 * SCREENSHOT_BUCKET  (scan-screenshots)  → PUBLIC
 *   Desktop + mobile JPEG/PNG screenshots.
 *   getPublicUrl() works — permanent URLs stored in DB,
 *   passed directly to Claude with no signing required.
 *
 * ARTIFACT_BUCKET  (scan-artifacts)  → PRIVATE
 *   artifact.json + incremental slice files.
 *   Only accessed server-side via service-role download.
 *   Bare storage path stored in DB; signed on demand if
 *   a URL is ever needed (e.g. debugging).
 */
const SCREENSHOT_BUCKET =
	process.env.SUPABASE_SCREENSHOT_BUCKET || 'scan-screenshots';

const ARTIFACT_BUCKET =
	process.env.SUPABASE_ARTIFACT_BUCKET || 'scan-artifacts';

export function getScreenshotBucket(): string {
	return SCREENSHOT_BUCKET;
}

export function getArtifactBucket(): string {
	return ARTIFACT_BUCKET;
}

const UPLOAD_ATTEMPTS = 3;
const UPLOAD_DELAY_MS = 2_000;
const SCREENSHOT_UPLOAD_TIMEOUT_MS = 20_000;
const ARTIFACT_UPLOAD_TIMEOUT_MS = 10_000;

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : 'unknown_error';
}

function shouldRetryUpload(error: unknown): boolean {
	return isRetryableNetworkError(error);
}

/**
 * Upload a buffer to the PUBLIC screenshot bucket and return the permanent
 * public URL. Because the bucket is public, getPublicUrl() is stable and
 * never expires — no signed URL creation is required later.
 */
async function uploadScreenshotBuffer(
	path: string,
	buffer: Buffer,
	contentType: string,
): Promise<string> {
	await withRetry(
		async () => {
			const supabase = getServiceSupabase();
			const { error } = await supabase.storage
				.from(SCREENSHOT_BUCKET)
				.upload(path, buffer, { contentType, upsert: true });

			if (error) throw new Error(error.message);
		},
		{
			attempts: UPLOAD_ATTEMPTS,
			delayMs: UPLOAD_DELAY_MS,
			shouldRetry: shouldRetryUpload,
			timeoutMs: SCREENSHOT_UPLOAD_TIMEOUT_MS,
		},
	);

	// Public bucket — getPublicUrl() works and is permanent.
	const supabase = getServiceSupabase();
	const { data } = supabase.storage.from(SCREENSHOT_BUCKET).getPublicUrl(path);
	return data.publicUrl;
}

/**
 * Upload a buffer to the PRIVATE artifact bucket and return the bare storage
 * path. Signed URLs are created on demand by the AI analysis step.
 */
async function uploadArtifactBuffer(
	path: string,
	buffer: Buffer,
	contentType: string,
): Promise<string> {
	await withRetry(
		async () => {
			const supabase = getServiceSupabase();
			const { error } = await supabase.storage
				.from(ARTIFACT_BUCKET)
				.upload(path, buffer, { contentType, upsert: true });

			if (error) throw new Error(error.message);
		},
		{
			attempts: UPLOAD_ATTEMPTS,
			delayMs: UPLOAD_DELAY_MS,
			shouldRetry: shouldRetryUpload,
			timeoutMs: ARTIFACT_UPLOAD_TIMEOUT_MS,
		},
	);

	// Private bucket — return bare path; caller signs on demand.
	return path;
}

async function uploadScreenshot(
	scanId: string,
	pageUrl: string,
	screenshot: Buffer | undefined,
	label: 'desktop' | 'mobile',
): Promise<{ path: string | null; publicUrl: string | null }> {
	if (!screenshot?.length) {
		return { path: null, publicUrl: null };
	}

	const profile: ImageCompressionProfile =
		label === 'desktop' ? 'desktop' : 'responsive';

	let uploadBuffer_ = screenshot;
	let contentType: 'image/png' | 'image/jpeg' = 'image/png';
	let extension: 'png' | 'jpg' = 'png';

	try {
		const optimized = await compressScreenshotBuffer(screenshot, profile);
		uploadBuffer_ = optimized.buffer;
		contentType = optimized.contentType;
		extension = optimized.extension;
	} catch (error) {
		console.warn('[artifacts] screenshot compression skipped', {
			label,
			pageUrl,
			error: getErrorMessage(error),
		});
	}

	const path =
		label === 'desktop' ?
			pageDesktopScreenshotPath(scanId, pageUrl, extension)
		:	pageMobileScreenshotPath(scanId, pageUrl, extension);

	// Public bucket → permanent public URL stored in DB and later passed to Claude.
	const publicUrl = await uploadScreenshotBuffer(
		path,
		uploadBuffer_,
		contentType,
	);
	return { path, publicUrl };
}

/**
 * Run Playwright output → upload screenshots (public) + artifact.json (private)
 * → return step payload. Browser work only; no DB writes.
 */
export async function uploadPageScanArtifact(
	scanId: string,
	pageUrl: string,
	result: ScanResult,
): Promise<PageBrowserStepResult> {
	const startedAt = new Date().toISOString();

	const [desktop, mobile] = await Promise.all([
		uploadScreenshot(scanId, pageUrl, result.screenshots?.desktop, 'desktop'),
		uploadScreenshot(scanId, pageUrl, result.screenshots?.mobile, 'mobile'),
	]);

	const finishedAt = new Date().toISOString();

	const artifact = scanResultToArtifact(result, {
		startedAt,
		finishedAt,
		screenshotPaths: {
			desktopPath: desktop.path,
			mobilePath: mobile.path,
			desktopPublicUrl: desktop.publicUrl,
			mobilePublicUrl: mobile.publicUrl,
		},
	});

	const artifactPath = pageArtifactJsonPath(scanId, pageUrl);
	const jsonBody = Buffer.from(JSON.stringify(artifact), 'utf-8');

	// Private artifact bucket — bare path returned, not a URL.
	await uploadArtifactBuffer(artifactPath, jsonBody, 'application/json');

	return {
		scanId,
		pageUrl,
		artifactPath,
		artifactStatus: artifact.status,
		scanOk: artifact.scanOk,
		// Full public https:// URLs — stored in scan_pages and later passed to Claude.
		screenshotDesktopUrl: desktop.publicUrl,
		screenshotMobileUrl: mobile.publicUrl,
	};
}
