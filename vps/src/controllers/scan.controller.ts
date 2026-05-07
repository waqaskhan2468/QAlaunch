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

	if (!scanId) {
		throw new AppError('scanId is required', 400);
	}

	if (urls.length === 0) {
		throw new AppError('urls[] is required', 400);
	}

	return { scanId, urls };
}

async function uploadScreenshotBuffer(
	screenshot: Buffer | undefined | null,
	scanId: string,
	pageUrl: string,
	fileName: string,
	label: string,
): Promise<ScreenshotUploadResult> {
	// ── Guard: reject missing or empty buffers before attempting upload ──
	// screenshots.ts throws on empty desktop buffers, but captureMobileScreenshot
	// returns null for non-fatal failures. Both cases must be caught here so we
	// never attempt to upload an empty file or write null to the DB.
	if (!screenshot || screenshot.length === 0) {
		const reason = !screenshot ? 'no buffer' : 'empty buffer (0 bytes)';
		console.warn(`[screenshot:${label}] skipped — ${reason}`, { pageUrl });
		return { url: null, warning: `Screenshot skipped (${label}): ${reason}` };
	}

	const filePath = `${scanId}/${sanitizeForPath(pageUrl)}-${fileName}.png`;
	let lastError = 'unknown_error';

	console.log(
		`[screenshot:${label}] ${pageUrl} uploading ${(screenshot.length / 1024 / 1024).toFixed(2)}MB`,
	);

	for (let attempt = 1; attempt <= SCREENSHOT_UPLOAD_RETRIES; attempt += 1) {
		try {
			const { error } = await supabase.storage
				.from(SCREENSHOT_BUCKET)
				.upload(filePath, screenshot, {
					contentType: 'image/png',
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

function buildPlaywrightPayload(
	result: ScanResult,
	responsive: ResponsivePayload[] | null,
) {
	const payload = {
		links: result.links ?? null,
		interactive: result.interactive ?? null,
		consoleMessages: result.consoleMessages ?? [],
		failedRequests: result.failedRequests ?? [],
		httpErrors: result.httpErrors ?? [],
		seoData: result.seoData ?? null,
		responsive,
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

			const upload = await uploadScreenshotBuffer(
				item.screenshot,
				scanId,
				pageUrl,
				`responsive-${index + 1}-${viewportSlug}`,
				`responsive:${item.viewport}`,
			);

			if (upload.warning) {
				warnings.push(upload.warning);
			}

			return {
				viewport: item.viewport,
				width: item.width,
				height: item.height,
				hasHorizontalScroll: item.hasHorizontalScroll,
				screenshot_url: upload.url,
			};
		}),
	);

	return responsivePayload;
}

function getMobileScreenshotUrlFromResponsive(
	responsivePayload: ResponsivePayload[] | null,
): string | null {
	if (!responsivePayload) return null;
	const iPhone14Url =
		responsivePayload.find((item) => item.viewport === MOBILE_VIEWPORT_NAME)
			?.screenshot_url ?? null;
	if (iPhone14Url) return iPhone14Url;

	// Fallback so AI analysis is not skipped when iPhone 14 upload fails.
	return (
		responsivePayload.find((item) => item.viewport === 'iPhone SE')
			?.screenshot_url ?? null
	);
}

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

	for (const upload of [desktopUpload]) {
		if (upload.warning) {
			uploadWarnings.push(upload.warning);
		}
	}

	const mobileScreenshotUrl = getMobileScreenshotUrlFromResponsive(
		responsivePayload,
	);
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

	// ── Build the DB patch conditionally ────────────────────────────────────
	// Only include screenshot URL columns when we actually have a URL.
	// Writing `null` to a non-nullable column (or one the UI expects to be set)
	// was causing silent DB errors. Screenshots are non-fatal — a missing URL
	// is surfaced via warnings[] instead.
	const screenshotPatch: Record<string, unknown> = {};

	if (desktopUpload.url) {
		screenshotPatch.screenshot_desktop_url = desktopUpload.url;
	} else {
		// Explicitly null so any previous value is cleared rather than left stale
		screenshotPatch.screenshot_desktop_url = null;
	}

	if (mobileScreenshotUrl) {
		screenshotPatch.screenshot_mobile_url = mobileScreenshotUrl;
	} else {
		screenshotPatch.screenshot_mobile_url = null;
	}

	await updateScanPage(scanId, result.url, {
		...screenshotPatch,
		raw_html: result.rawHtml ?? null,
		axe_violations: result.axe ?? null,
		playwright_data: buildPlaywrightPayload(
			resultWithUploadWarnings,
			responsivePayload,
		),
	});
}

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
