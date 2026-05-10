import { Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import type {
	ResponsivePayload,
	ScanRequest,
	ScanResult,
} from '../types/scan.types';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { runPlaywrightScan } from '../services/index';
import { MOBILE_VIEWPORT_NAME } from '../services/responsive';
import type { ScanStatus, ScreenshotUploadResult } from '../types/scan.types';
import {
	compressScreenshotBuffer,
	type ImageCompressionProfile,
} from '../utils/imageCompression';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SCREENSHOT_BUCKET =
	process.env.SUPABASE_SCREENSHOT_BUCKET || 'scan-screenshots';

const SCREENSHOT_UPLOAD_RETRIES = 3;
const SCREENSHOT_UPLOAD_RETRY_DELAY_MS = 1_000;
const DEFAULT_PAGE_UPDATE_CONCURRENCY = 2;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
	throw new AppError('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY', 500);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ─── Small utilities ───────────────────────────────────────────────────────

function nowIso(): string {
	return new Date().toISOString();
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : 'unknown_error';
}

function hasSuccessfulNavigation(result: ScanResult): boolean {
	return result.steps.some(
		(step) => step.name.startsWith('navigate') && step.ok,
	);
}

function getAxeGateFailure(result: ScanResult) {
	const navigationOk = hasSuccessfulNavigation(result);
	const axeStep = result.steps.find((step) => step.name === 'axe');
	const axeStepOk = Boolean(axeStep?.ok);
	const hasAxeResult = Array.isArray(result.axe);

	if (!navigationOk || (axeStepOk && hasAxeResult)) return null;

	return {
		classification: 'accessibility_gate_fail',
		axeStepOk,
		axeStepError:
			axeStep?.error ?? (axeStepOk ? 'axe_result_missing' : 'axe_step_missing'),
		navigationOk,
		hasDesktopScreenshot: Boolean(result.screenshots?.desktop),
		hasMobileScreenshot: Boolean(result.screenshots?.mobile),
	};
}

function logAxeGateFailure(scanId: string, result: ScanResult): void {
	const failure = getAxeGateFailure(result);
	if (!failure) return;

	console.warn('[scan:axe_gate_failed]', {
		scanId,
		pageUrl: result.url,
		...failure,
	});
}

function getPageUpdateConcurrency(pageCount: number): number {
	const configured = Number.parseInt(
		process.env.SCAN_PAGE_UPDATE_CONCURRENCY ??
			`${DEFAULT_PAGE_UPDATE_CONCURRENCY}`,
		10,
	);
	const safeConfigured =
		Number.isFinite(configured) && configured > 0 ?
			configured
		:	DEFAULT_PAGE_UPDATE_CONCURRENCY;

	return Math.max(1, Math.min(safeConfigured, pageCount));
}

function sanitizeForPath(value: string): string {
	return value
		.toLowerCase()
		.replace(/^https?:\/\//, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 120);
}

function validateScanRequest(body: Partial<ScanRequest>): ScanRequest {
	const scanId = typeof body.scanId === 'string' ? body.scanId.trim() : '';
	const urls =
		Array.isArray(body.urls) ?
			body.urls.map((url) => url.trim()).filter(Boolean)
		:	[];

	if (!scanId) throw new AppError('scanId is required', 400);
	if (urls.length === 0) throw new AppError('urls[] is required', 400);

	return { scanId, urls };
}

// ─── Screenshot upload ─────────────────────────────────────────────────────

async function uploadScreenshotBuffer(
	screenshot: Buffer | undefined | null,
	scanId: string,
	pageUrl: string,
	fileName: string,
	label: string,
): Promise<ScreenshotUploadResult> {
	// Guard: reject missing or empty buffers before attempting upload.
	// screenshots.ts throws on empty desktop buffers, but captureMobileScreenshot
	// returns null for non-fatal failures. Both must be caught here so we never
	// attempt to upload an empty file or write null to the DB.
	if (!screenshot || screenshot.length === 0) {
		const reason = !screenshot ? 'no buffer' : 'empty buffer (0 bytes)';
		console.warn(`[screenshot:${label}] skipped — ${reason}`, { pageUrl });
		return { url: null, warning: `Screenshot skipped (${label}): ${reason}` };
	}

	const compressionProfile: ImageCompressionProfile =
		label === 'desktop' ? 'desktop' : 'responsive';

	let uploadBuffer = screenshot;
	let contentType: 'image/png' | 'image/jpeg' = 'image/png';
	let extension: 'png' | 'jpg' = 'png';

	try {
		const optimized = await compressScreenshotBuffer(
			screenshot,
			compressionProfile,
		);
		uploadBuffer = optimized.buffer;
		contentType = optimized.contentType;
		extension = optimized.extension;
	} catch (error) {
		console.warn(`[screenshot:${label}] compression skipped`, {
			pageUrl,
			error: getErrorMessage(error),
		});
	}

	const filePath = `${scanId}/${sanitizeForPath(pageUrl)}-${fileName}.${extension}`;
	let lastError = 'unknown_error';

	console.log(
		`[screenshot:${label}] ${pageUrl} uploading ${(uploadBuffer.length / 1024 / 1024).toFixed(2)}MB`,
	);

	for (let attempt = 1; attempt <= SCREENSHOT_UPLOAD_RETRIES; attempt += 1) {
		try {
			const { error } = await supabase.storage
				.from(SCREENSHOT_BUCKET)
				.upload(filePath, uploadBuffer, {
					contentType,
					upsert: true,
				});

			if (error) {
				lastError = error.message;
			} else {
				const { data } = supabase.storage
					.from(SCREENSHOT_BUCKET)
					.getPublicUrl(filePath);

				return { url: data.publicUrl || filePath };
			}
		} catch (error) {
			lastError = getErrorMessage(error);
		}

		if (attempt < SCREENSHOT_UPLOAD_RETRIES) {
			console.warn(
				`[screenshot:${label}] upload attempt ${attempt} failed: ${lastError} — retrying in ${SCREENSHOT_UPLOAD_RETRY_DELAY_MS * attempt}ms`,
			);
			await sleep(SCREENSHOT_UPLOAD_RETRY_DELAY_MS * attempt);
		}
	}

	console.error(
		`[screenshot:${label}] all ${SCREENSHOT_UPLOAD_RETRIES} upload attempts failed`,
		{ pageUrl, lastError },
	);

	return {
		url: null,
		warning: `Screenshot upload failed after ${SCREENSHOT_UPLOAD_RETRIES} attempts (${label}): ${lastError}`,
	};
}

// ─── Responsive screenshot upload (slice-aware) ────────────────────────────

/**
 * Upload all screenshots for every responsive viewport.
 *
 * Mobile viewports produce multiple slices (stored in `item.slices`).
 * Desktop/tablet produce a single full-page image (`item.screenshot`).
 *
 * Each slice gets its own storage path and public URL, stored in
 * `screenshot_slice_urls`. The first slice URL is also written to
 * `screenshot_url` for backward-compatible callers.
 */
async function uploadResponsiveScreenshots(
	scanId: string,
	pageUrl: string,
	result: ScanResult,
	warnings: string[],
): Promise<ResponsivePayload[] | null> {
	if (!result.responsive) return null;

	const responsivePayload = await Promise.all(
		result.responsive.map(async (item, index) => {
			const viewportSlug = sanitizeForPath(
				item.viewport || `viewport-${index + 1}`,
			);

			// Use slices array when available (mobile), otherwise wrap the single
			// full-page screenshot so the upload loop is uniform.
			const slices = item.slices?.length ? item.slices : [item.screenshot];

			const sliceUploads = await Promise.all(
				slices.map((slice, sliceIndex) =>
					uploadScreenshotBuffer(
						slice,
						scanId,
						pageUrl,
						// e.g. "responsive-2-iphone-14-s1.png"
						`responsive-${index + 1}-${viewportSlug}-s${sliceIndex + 1}`,
						`responsive:${item.viewport}:slice${sliceIndex + 1}`,
					),
				),
			);

			for (const upload of sliceUploads) {
				if (upload.warning) warnings.push(upload.warning);
			}

			return {
				viewport: item.viewport,
				width: item.width,
				height: item.height,
				hasHorizontalScroll: item.hasHorizontalScroll,
				// First slice URL kept for backward compatibility
				screenshot_url: sliceUploads[0]?.url ?? null,
				// All slice URLs — what Claude receives for visual analysis
				screenshot_slice_urls: sliceUploads
					.map((u) => u.url)
					.filter((url): url is string => typeof url === 'string' && url.length > 0),
			} satisfies ResponsivePayload;
		}),
	);

	return responsivePayload;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function getMobileScreenshotUrlFromResponsive(
	responsivePayload: ResponsivePayload[] | null,
): string | null {
	if (!responsivePayload) return null;

	return (
		responsivePayload.find((item) => item.viewport === MOBILE_VIEWPORT_NAME)
			?.screenshot_url ?? null
	);
}

function getMobileSliceUrlsFromResponsive(
	responsivePayload: ResponsivePayload[] | null,
): string[] {
	if (!responsivePayload) return [];

	const mobileViewport = responsivePayload.find(
		(item) => item.viewport === MOBILE_VIEWPORT_NAME,
	);
	if (!mobileViewport) return [];

	return (mobileViewport.screenshot_slice_urls ?? []).filter(
		(url): url is string => typeof url === 'string' && url.length > 0,
	);
}

function buildResponsiveSlicesPayload(
	responsivePayload: ResponsivePayload[] | null,
): Array<{ viewport: string; width: number; slice_urls: string[] }> {
	if (!responsivePayload) return [];

	return responsivePayload.map((item) => ({
		viewport: item.viewport,
		width: item.width,
		slice_urls: (item.screenshot_slice_urls ?? [])
			.filter((url): url is string => typeof url === 'string' && url.length > 0),
	}));
}

function buildPlaywrightPayload(
	result: ScanResult,
) {
	const payload = {
		links: result.links ?? null,
		interactive: result.interactive ?? null,
		consoleMessages: result.consoleMessages ?? [],
		failedRequests: result.failedRequests ?? [],
		httpErrors: result.httpErrors ?? [],
		seoData: result.seoData ?? null,
		steps: result.steps ?? [],
		warnings: result.warnings ?? [],
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

// ─── DB helpers ────────────────────────────────────────────────────────────

async function updateScanStatus(
	scanId: string,
	patch: Record<string, unknown>,
): Promise<void> {
	const { error } = await supabase.from('scans').update(patch).eq('id', scanId);

	if (error) {
		throw new AppError(`Failed to update scan: ${error.message}`, 500);
	}
}

async function updateScanPage(
	scanId: string,
	pageUrl: string,
	patch: Record<string, unknown>,
): Promise<void> {
	const { data, error } = await supabase
		.from('scan_pages')
		.update(patch)
		.eq('scan_id', scanId)
		.eq('page_url', pageUrl)
		.select('id');

	if (error) {
		throw new AppError(
			`Failed to update scan page (${pageUrl}): ${error.message}`,
			500,
		);
	}

	if (!data?.length) {
		throw new AppError(
			`Failed to update scan page (${pageUrl}): no matching scan_pages row`,
			500,
		);
	}
}

async function markScanFailed(scanId: string, message: string): Promise<void> {
	await updateScanStatus(scanId, {
		status: 'failed',
		error_message: message,
		completed_at: nowIso(),
	});
}

// ─── Per-page result processor ─────────────────────────────────────────────

async function processScanResult(
	scanId: string,
	result: ScanResult,
): Promise<void> {
	const uploadWarnings: string[] = [];

	const [desktopUpload, responsivePayload] = await Promise.all([
		uploadScreenshotBuffer(
			result.screenshots?.desktop,
			scanId,
			result.url,
			'desktop',
			'desktop',
		),
		uploadResponsiveScreenshots(scanId, result.url, result, uploadWarnings),
	]);

	if (desktopUpload.warning) {
		uploadWarnings.push(desktopUpload.warning);
	}

	const mobileScreenshotUrl =
		getMobileScreenshotUrlFromResponsive(responsivePayload);
	const mobileSliceUrls = getMobileSliceUrlsFromResponsive(responsivePayload);
	const responsiveSlicesPayload =
		buildResponsiveSlicesPayload(responsivePayload);

	if (!mobileScreenshotUrl) {
		uploadWarnings.push(
			`Screenshot missing (mobile): ${MOBILE_VIEWPORT_NAME} responsive screenshot URL not available`,
		);
	}

	logAxeGateFailure(scanId, result);

	const resultWithUploadWarnings: ScanResult = {
		...result,
		warnings: [...(result.warnings ?? []), ...uploadWarnings],
	};

	// Build the DB patch conditionally.
	// Writing `null` to a non-nullable column was causing silent DB errors.
	// Screenshots are non-fatal — a missing URL is surfaced via warnings[] instead.
	const screenshotPatch: Record<string, unknown> = {};

	screenshotPatch.screenshot_desktop_url = desktopUpload.url ?? null;

	screenshotPatch.screenshot_mobile_url = mobileScreenshotUrl ?? null;
	screenshotPatch.screenshot_mobile_slice_urls = mobileSliceUrls;
	screenshotPatch.screenshot_responsive_slices = responsiveSlicesPayload;

	await updateScanPage(scanId, result.url, {
		...screenshotPatch,
		raw_html: result.rawHtml ?? null,
		axe_violations: result.axe ?? null,
		playwright_data: buildPlaywrightPayload(resultWithUploadWarnings),
	});
}

// ─── Scan orchestration ────────────────────────────────────────────────────

async function finalizeScan(
	scanId: string,
	results: ScanResult[],
): Promise<ScanStatus> {
	const hasSuccessfulPage = results.some((result) => result.ok);
	const status: ScanStatus = hasSuccessfulPage ? 'analyzing' : 'failed';

	await updateScanStatus(scanId, {
		status,
		completed_at: status === 'failed' ? nowIso() : null,
		error_message: status === 'failed' ? 'All pages failed to scan.' : null,
	});

	return status;
}

async function processScanResults(
	scanId: string,
	results: ScanResult[],
): Promise<void> {
	const concurrency = getPageUpdateConcurrency(results.length);

	for (let index = 0; index < results.length; index += concurrency) {
		const chunk = results.slice(index, index + concurrency);
		await Promise.all(chunk.map((result) => processScanResult(scanId, result)));
	}
}

// ─── Route handler ─────────────────────────────────────────────────────────

export const runScan = asyncHandler(async (req, res: Response) => {
	const { scanId, urls } = validateScanRequest(req.body);

	try {
		await updateScanStatus(scanId, {
			status: 'analyzing',
			error_message: null,
		});

		const results = await runPlaywrightScan(urls, scanId);

		await processScanResults(scanId, results);

		const finalStatus = await finalizeScan(scanId, results);

		return res.json({
			success: true,
			scanId,
			finalStatus,
			processedPages: results.length,
		});
	} catch (error: unknown) {
		const message = getErrorMessage(error);

		console.error('[runScan] failed:', message);

		try {
			await markScanFailed(scanId, message);
		} catch (markFailedError: unknown) {
			console.error(
				'[runScan] failed to mark scan as failed:',
				markFailedError,
			);
		}

		throw error instanceof AppError ? error : new AppError(message, 500);
	}
});
