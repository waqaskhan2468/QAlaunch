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

type ScanStatus = 'pending' | 'crawling' | 'analyzing' | 'done' | 'failed';

type ScreenshotUploadResult = {
	url: string | null;
	warning?: string;
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SCREENSHOT_BUCKET =
	process.env.SUPABASE_SCREENSHOT_BUCKET || 'scan-screenshots';

const SCREENSHOT_UPLOAD_RETRIES = 3;
const SCREENSHOT_UPLOAD_RETRY_DELAY_MS = 1_000;

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
	screenshot: Buffer | undefined,
	scanId: string,
	pageUrl: string,
	fileName: string,
	label: string,
): Promise<ScreenshotUploadResult> {
	if (!screenshot) return { url: null };

	const filePath = `${scanId}/${sanitizeForPath(pageUrl)}-${fileName}.jpg`;
	let lastError = 'unknown_error';

	console.log(
		`[screenshot:${label}] uploading ${(screenshot.length / 1024 / 1024).toFixed(2)}MB`,
	);

	for (let attempt = 1; attempt <= SCREENSHOT_UPLOAD_RETRIES; attempt += 1) {
		try {
			const { error } = await supabase.storage
				.from(SCREENSHOT_BUCKET)
				.upload(filePath, screenshot, {
					contentType: 'image/jpeg',
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
			await sleep(SCREENSHOT_UPLOAD_RETRY_DELAY_MS * attempt);
		}
	}

	return {
		url: null,
		warning: `Screenshot upload failed (${label}): ${lastError}`,
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
	const { error } = await supabase
		.from('scan_pages')
		.update(patch)
		.eq('scan_id', scanId)
		.eq('page_url', pageUrl);

	if (error) {
		throw new AppError(
			`Failed to update scan page (${pageUrl}): ${error.message}`,
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

	const responsivePayload: ResponsivePayload[] = [];

	for (const [index, item] of result.responsive.entries()) {
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

		responsivePayload.push({
			viewport: item.viewport,
			width: item.width,
			height: item.height,
			hasHorizontalScroll: item.hasHorizontalScroll,
			screenshot_url: upload.url,
		});
	}

	return responsivePayload;
}

async function processScanResult(
	scanId: string,
	result: ScanResult,
): Promise<void> {
	const uploadWarnings: string[] = [];

	if (!result.ok) {
		await updateScanPage(scanId, result.url, {
			screenshot_desktop_url: null,
			screenshot_mobile_url: null,
			axe_violations: result.axe ?? null,
			playwright_data: buildPlaywrightPayload(result, null),
		});

		return;
	}

	const desktopUpload = await uploadScreenshotBuffer(
		result.screenshots?.desktop,
		scanId,
		result.url,
		'desktop',
		'desktop',
	);

	if (desktopUpload.warning) {
		uploadWarnings.push(desktopUpload.warning);
	}

	const mobileUpload = await uploadScreenshotBuffer(
		result.screenshots?.mobile,
		scanId,
		result.url,
		'mobile',
		'mobile',
	);

	if (mobileUpload.warning) {
		uploadWarnings.push(mobileUpload.warning);
	}

	const responsivePayload = await uploadResponsiveScreenshots(
		scanId,
		result.url,
		result,
		uploadWarnings,
	);

	const resultWithUploadWarnings: ScanResult = {
		...result,
		warnings: [...(result.warnings ?? []), ...uploadWarnings],
	};

	await updateScanPage(scanId, result.url, {
		screenshot_desktop_url: desktopUpload.url,
		screenshot_mobile_url: mobileUpload.url,
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
	const status: ScanStatus = hasSuccessfulPage ? 'done' : 'failed';

	await updateScanStatus(scanId, {
		status,
		completed_at: nowIso(),
		error_message: status === 'failed' ? 'All pages failed to scan.' : null,
	});

	return status;
}

export const runScan = asyncHandler(async (req, res: Response) => {
	const { scanId, urls } = validateScanRequest(req.body);

	try {
		await updateScanStatus(scanId, {
			status: 'analyzing',
			error_message: null,
		});

		const results = await runPlaywrightScan(urls, scanId);

		for (const result of results) {
			await processScanResult(scanId, result);
		}

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
