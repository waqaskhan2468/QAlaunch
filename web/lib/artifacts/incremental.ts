import { getServiceSupabase } from '@/lib/db/supabase';
import {
	isRetryableNetworkError,
	updateScanPageRecord,
} from '@/lib/db/supabase-retry';
import { withRetry } from '@/lib/scan/services/retry';
import type { ScanResult } from '@/lib/scan/types/scan.types';
import {
	compressScreenshotBuffer,
	type ImageCompressionProfile,
} from '@/lib/scan/utils/imageCompression';
import { buildPlaywrightPayloadFromScanResult } from './playwright-payload';
import {
	pageDesktopScreenshotPath,
	pageMobileScreenshotPath,
} from './paths';
import type { PageBrowserStepResult } from './types';
import { getScreenshotBucket } from './upload';
import { logScanTiming } from '@/lib/scan/services/scan-timing';

const UPLOAD_ATTEMPTS = 2;
const UPLOAD_DELAY_MS = 1_000;
// Per-attempt ceiling kept short so upload retries can't consume the page budget.
// Genuine Supabase uploads finish in 1–4 s; 8 s catches TCP hangs without over-spending.
const SCREENSHOT_UPLOAD_TIMEOUT_MS = 8_000;

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : 'unknown_error';
}

function shouldRetryUpload(error: unknown): boolean {
	return isRetryableNetworkError(error);
}

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
			timeoutMs: SCREENSHOT_UPLOAD_TIMEOUT_MS,
		},
	);
	const supabase = getServiceSupabase();
	const { data } = supabase.storage
		.from(getScreenshotBucket())
		.getPublicUrl(path);
	return data.publicUrl;
}

/**
 * Lightweight scan writer.
 *
 * Uploads screenshots to the public screenshot bucket during the scan, then
 * writes ALL scan data directly to the scan_pages DB row in finalize() — no
 * Storage JSON files (no slices, no artifact.json).
 *
 * DB write happens once, at the very end, so there are no incremental partial
 * checkpoints. The trade-off is simpler code and fewer Storage round-trips at
 * the cost of losing incremental recovery for partially-completed scans.
 */
export class ScanWriter {
	private desktopPublicUrl: string | null = null;
	private mobilePublicUrl: string | null = null;

	constructor(
		private readonly scanId: string,
		private readonly pageUrl: string,
	) {}

	/**
	 * Returns true if the screenshot for the given label was successfully
	 * uploaded. Used by index.ts to decide whether a retry upload is needed.
	 */
	hasScreenshot(label: 'desktop' | 'mobile'): boolean {
		return label === 'desktop' ?
				this.desktopPublicUrl !== null
			:	this.mobilePublicUrl !== null;
	}

	async uploadScreenshot(
		label: 'desktop' | 'mobile',
		screenshot: Buffer,
	): Promise<void> {
		if (!screenshot?.length) return;

		const startedAt = Date.now();
		const step = `upload:screenshot:${label}`;

		try {
			const profile: ImageCompressionProfile =
				label === 'desktop' ? 'desktop' : 'responsive';

			let uploadBuffer = screenshot;
			let contentType: 'image/png' | 'image/jpeg' = 'image/jpeg';
			let extension: 'png' | 'jpg' = 'jpg';

			try {
				const optimized = await compressScreenshotBuffer(screenshot, profile);
				uploadBuffer = optimized.buffer;
				contentType = optimized.contentType;
				extension = optimized.extension;
			} catch (error) {
				console.warn('[scan] screenshot compression skipped', {
					label,
					pageUrl: this.pageUrl,
					error: getErrorMessage(error),
				});
			}

			const path =
				label === 'desktop' ?
					pageDesktopScreenshotPath(this.scanId, this.pageUrl, extension)
				:	pageMobileScreenshotPath(this.scanId, this.pageUrl, extension);

			const publicUrl = await uploadScreenshotBytes(
				path,
				uploadBuffer,
				contentType,
			);

			if (label === 'desktop') {
				this.desktopPublicUrl = publicUrl;
			} else {
				this.mobilePublicUrl = publicUrl;
			}

			logScanTiming(step, Date.now() - startedAt, {
				scanId: this.scanId,
				pageUrl: this.pageUrl,
				ok: true,
				bytes: screenshot.length,
			});
		} catch (error) {
			logScanTiming(step, Date.now() - startedAt, {
				scanId: this.scanId,
				pageUrl: this.pageUrl,
				ok: false,
				error: getErrorMessage(error),
			});
			console.warn('[scan] screenshot upload failed', {
				scanId: this.scanId,
				pageUrl: this.pageUrl,
				label,
				error: getErrorMessage(error),
			});
		}
	}

	/**
	 * Write all scan data to the DB row in one shot, return the step result.
	 *
	 * playwright_data (version 4) holds the complete payload that the AI analysis
	 * step reads directly from the DB — no Storage download needed.
	 */
	async finalize(result: ScanResult): Promise<PageBrowserStepResult> {
		const playwrightData = buildPlaywrightPayloadFromScanResult(result);

		await updateScanPageRecord(this.scanId, this.pageUrl, {
			screenshot_desktop_url: this.desktopPublicUrl,
			screenshot_mobile_url: this.mobilePublicUrl,
			playwright_data: playwrightData,
			axe_violations: result.axe ?? null,
			raw_html: null,
		});

		return {
			scanId: this.scanId,
			pageUrl: this.pageUrl,
			scanOk: result.ok,
			screenshotDesktopUrl: this.desktopPublicUrl,
			screenshotMobileUrl: this.mobilePublicUrl,
		};
	}
}
