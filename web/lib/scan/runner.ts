import type { ServiceSupabase } from '@/lib/db/supabase';
import { runPlaywrightScanForUrl } from './services/index';
import { MOBILE_VIEWPORT_NAME } from './services/responsive';
import type { ScanStatus } from '@/types/zod';
import type {
	ResponsivePayload,
	ScanResult,
	ScreenshotUploadResult,
} from './types/scan.types';
import { buildProgrammaticRollup } from './utils/programmaticSummary';
import {
	compressScreenshotBuffer,
	type ImageCompressionProfile,
} from './utils/imageCompression';

const SCREENSHOT_BUCKET =
	process.env.SUPABASE_SCREENSHOT_BUCKET || 'scan-screenshots';

const SCREENSHOT_UPLOAD_RETRIES = 3;
const SCREENSHOT_UPLOAD_RETRY_DELAY_MS = 1_000;

class ScannerError extends Error {
	constructor(
		message: string,
		readonly status = 500,
	) {
		super(message);
		this.name = 'ScannerError';
	}
}

// ─── Structured logger ─────────────────────────────────────────────────────

type LogLevel = 'info' | 'warn' | 'error';

function slog(
	level: LogLevel,
	event: string,
	fields: Record<string, unknown> = {},
): void {
	const entry = JSON.stringify({
		ts: new Date().toISOString(),
		level,
		event,
		...fields,
	});
	if (level === 'error') {
		console.error(entry);
	} else if (level === 'warn') {
		console.warn(entry);
	} else {
		console.log(entry);
	}
}

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

	slog('warn', 'scan:axe_gate_failed', {
		scanId,
		pageUrl: result.url,
		...failure,
	});
}

function sanitizeForPath(value: string): string {
	return value
		.toLowerCase()
		.replace(/^https?:\/\//, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 120);
}

// ─── Screenshot upload ─────────────────────────────────────────────────────

async function uploadScreenshotBuffer(
	supabase: ServiceSupabase,
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
		slog('warn', 'screenshot:skipped', { label, pageUrl, reason });
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
		slog('warn', 'screenshot:compression_skipped', {
			label,
			pageUrl,
			error: getErrorMessage(error),
		});
	}

	const filePath = `${scanId}/${sanitizeForPath(pageUrl)}-${fileName}.${extension}`;
	let lastError = 'unknown_error';

	slog('info', 'screenshot:uploading', {
		label,
		pageUrl,
		sizeMb: Number((uploadBuffer.length / 1024 / 1024).toFixed(2)),
	});

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
			slog('warn', 'screenshot:upload_retry', {
				label,
				pageUrl,
				attempt,
				lastError,
				retryDelayMs: SCREENSHOT_UPLOAD_RETRY_DELAY_MS * attempt,
			});
			await sleep(SCREENSHOT_UPLOAD_RETRY_DELAY_MS * attempt);
		}
	}

	slog('error', 'screenshot:upload_failed', {
		label,
		pageUrl,
		attempts: SCREENSHOT_UPLOAD_RETRIES,
		lastError,
	});

	return {
		url: null,
		warning: `Screenshot upload failed after ${SCREENSHOT_UPLOAD_RETRIES} attempts (${label}): ${lastError}`,
	};
}

// ─── Responsive screenshot upload (slice-aware) ────────────────────────────

/**
 * Upload all screenshots for every responsive viewport.
 *
 * Each viewport uses one full-page `item.screenshot`. Multiple uploads only
 * occur when `item.slices` is set (legacy). URLs are stored in
 * `screenshot_slice_urls` with `screenshot_url` as the first entry.
 */
async function uploadResponsiveScreenshots(
	supabase: ServiceSupabase,
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
						supabase,
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
	const programmaticRollup = buildProgrammaticRollup(result.brokenStates);

	const payload = {
		playwrightDataVersion: 3,
		links: result.links ?? null,
		interactive: result.interactive ?? null,
		consoleMessages: result.consoleMessages ?? [],
		failedRequests: result.failedRequests ?? [],
		httpErrors: result.httpErrors ?? [],
		seoData: result.seoData ?? null,
		steps: result.steps ?? [],
		warnings: result.warnings ?? [],
		brokenStates: result.brokenStates ?? null,
		programmaticRollup,
		responseSecurity: result.responseSecurityMeta ?? null,
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
	supabase: ServiceSupabase,
	scanId: string,
	patch: Record<string, unknown>,
): Promise<void> {
	const { error } = await supabase.from('scans').update(patch).eq('id', scanId);

	if (error) {
		throw new ScannerError(`Failed to update scan: ${error.message}`, 500);
	}
}

async function updateScanPage(
	supabase: ServiceSupabase,
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
		throw new ScannerError(
			`Failed to update scan page (${pageUrl}): ${error.message}`,
			500,
		);
	}

	if (!data?.length) {
		throw new ScannerError(
			`Failed to update scan page (${pageUrl}): no matching scan_pages row`,
			500,
		);
	}
}

async function markScanFailed(
	supabase: ServiceSupabase,
	scanId: string,
	message: string,
): Promise<void> {
	await updateScanStatus(supabase, scanId, {
		status: 'failed',
		error_message: message,
		completed_at: nowIso(),
	});
}

// ─── Per-page result processor ─────────────────────────────────────────────

async function processScanResult(
	supabase: ServiceSupabase,
	scanId: string,
	result: ScanResult,
): Promise<void> {
	const uploadWarnings: string[] = [];

	const [desktopUpload, responsivePayload] = await Promise.all([
		uploadScreenshotBuffer(
			supabase,
			result.screenshots?.desktop,
			scanId,
			result.url,
			'desktop',
			'desktop',
		),
		uploadResponsiveScreenshots(supabase, scanId, result.url, result, uploadWarnings),
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

	await updateScanPage(supabase, scanId, result.url, {
		...screenshotPatch,
		raw_html: result.rawHtml ?? null,
		axe_violations: result.axe ?? null,
		playwright_data: buildPlaywrightPayload(resultWithUploadWarnings),
	});
}

// ─── Inngest step entrypoints (one page per step) ───────────────────────────

export async function prepareScannerScan(
	supabase: ServiceSupabase,
	scanId: string,
): Promise<void> {
	await updateScanStatus(supabase, scanId, {
		status: 'analyzing',
		error_message: null,
	});
}

export async function scanAndPersistPage(
	supabase: ServiceSupabase,
	scanId: string,
	url: string,
): Promise<{ ok: boolean }> {
	const result = await runPlaywrightScanForUrl(scanId, url);
	await processScanResult(supabase, scanId, result);
	return { ok: result.ok };
}

export async function finalizeScannerFromDb(
	supabase: ServiceSupabase,
	scanId: string,
): Promise<ScanStatus> {
	const { data: pages, error } = await supabase
		.from('scan_pages')
		.select('playwright_data')
		.eq('scan_id', scanId);

	if (error) {
		throw new ScannerError(`Failed to load scan pages: ${error.message}`, 500);
	}

	const hasSuccessfulPage = (pages ?? []).some((row) => {
		const payload = row.playwright_data as { scanOk?: boolean } | null;
		return payload?.scanOk === true;
	});

	const status: ScanStatus = hasSuccessfulPage ? 'analyzing' : 'failed';

	await updateScanStatus(supabase, scanId, {
		status,
		completed_at: status === 'failed' ? nowIso() : null,
		error_message: status === 'failed' ? 'All pages failed to scan.' : null,
	});

	return status;
}

export async function markScannerFailed(
	supabase: ServiceSupabase,
	scanId: string,
	message: string,
): Promise<void> {
	slog('error', 'scan:failed', { scanId, error: message });
	try {
		await markScanFailed(supabase, scanId, message);
	} catch (markFailedError: unknown) {
		slog('error', 'scan:mark_failed_error', {
			scanId,
			error: getErrorMessage(markFailedError),
		});
	}
}
