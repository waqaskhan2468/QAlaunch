import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { runPlaywrightScan } from '../services/playwright.service';
import type { ScanRequest, ScanResult } from '../types/scan.types';

type ScanStatus = 'pending' | 'crawling' | 'analyzing' | 'done' | 'failed';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SCREENSHOT_BUCKET =
	process.env.SUPABASE_SCREENSHOT_BUCKET || 'scan-screenshots';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
	throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function nowIso() {
	return new Date().toISOString();
}

function sanitizeForPath(value: string): string {
	return value
		.toLowerCase()
		.replace(/^https?:\/\//, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 120);
}

async function uploadBase64Screenshot(
	base64: string | undefined,
	scanId: string,
	pageUrl: string,
	variant: 'desktop' | 'mobile',
): Promise<string | null> {
	if (!base64) return null;

	const filePath = `${scanId}/${sanitizeForPath(pageUrl)}-${variant}.jpg`;
	const bytes = Buffer.from(base64, 'base64');

	const { error } = await supabase.storage
		.from(SCREENSHOT_BUCKET)
		.upload(filePath, bytes, {
			contentType: 'image/jpeg',
			upsert: true,
		});

	if (error) {
		throw new Error(`Screenshot upload failed (${variant}): ${error.message}`);
	}

	const { data } = supabase.storage
		.from(SCREENSHOT_BUCKET)
		.getPublicUrl(filePath);
	return data.publicUrl || filePath;
}

function buildPlaywrightData(r: ScanResult) {
	return {
		links: r.links ?? null,
		interactive: r.interactive ?? null,
		consoleMessages: r.consoleMessages ?? [],
		failedRequests: r.failedRequests ?? [],
		httpErrors: r.httpErrors ?? [],
		seoData: r.seoData ?? null,
		responsive: r.responsive ?? null,
		steps: r.steps ?? [],
		warnings: r.warnings ?? [],
	};
}

function buildPlaywrightPayload(r: ScanResult) {
	const base = buildPlaywrightData(r);
	if (r.ok) {
		return { ...base, scanOk: true as const };
	}
	return {
		...base,
		scanOk: false as const,
		error: r.error ?? 'scan_failed',
	};
}

async function updateScanPageRow(
	scanId: string,
	pageUrl: string,
	patch: Record<string, unknown>,
) {
	const { error } = await supabase
		.from('scan_pages')
		.update(patch)
		.eq('scan_id', scanId)
		.eq('page_url', pageUrl);

	if (error) {
		throw new Error(
			`Failed to update scan_pages (${scanId}, ${pageUrl}): ${error.message}`,
		);
	}
}

async function finalizeScanFromResults(
	scanId: string,
	results: ScanResult[],
): Promise<ScanStatus> {
	const total = results.length;
	const successes = results.filter((r) => r.ok).length;

	let status: ScanStatus;
	if (total === 0 || successes === 0) {
		status = 'failed';
	} else {
		status = 'done';
	}

	const { error: updateErr } = await supabase
		.from('scans')
		.update({
			status,
			completed_at: nowIso(),
			error_message: status === 'failed' ? 'All pages failed to scan.' : null,
		})
		.eq('id', scanId);

	if (updateErr)
		throw new Error(`Failed to update scans: ${updateErr.message}`);

	return status;
}

async function markScanFailed(scanId: string, message: string) {
	await supabase
		.from('scans')
		.update({
			status: 'failed',
			error_message: message,
			completed_at: nowIso(),
		})
		.eq('id', scanId);
}

export async function runScan(req: Request, res: Response) {
	let scanIdForCatch: string | null = null;

	try {
		const { urls, scanId } = req.body as ScanRequest;
		scanIdForCatch = scanId ?? null;

		if (!scanId) {
			return res.status(400).json({ error: 'scanId is required' });
		}

		if (!Array.isArray(urls) || urls.length === 0) {
			return res.status(400).json({ error: 'urls[] is required' });
		}

		const { error: parentStartErr } = await supabase
			.from('scans')
			.update({ status: 'analyzing', error_message: null })
			.eq('id', scanId);

		if (parentStartErr) {
			return res.status(500).json({ error: parentStartErr.message });
		}

		const results = await runPlaywrightScan(urls, scanId);
		

		for (const r of results) {
			if (!r.ok) {
				await updateScanPageRow(scanId, r.url, {
					screenshot_desktop_url: null,
					screenshot_mobile_url: null,
					axe_violations: r.axe ?? null,
					playwright_data: buildPlaywrightPayload(r),
				});
				continue;
			}

			const desktopUrl = await uploadBase64Screenshot(
				r.screenshots?.desktop,
				scanId,
				r.url,
				'desktop',
			);
			const mobileUrl = await uploadBase64Screenshot(
				r.screenshots?.mobile,
				scanId,
				r.url,
				'mobile',
			);

			await updateScanPageRow(scanId, r.url, {
				screenshot_desktop_url: desktopUrl,
				screenshot_mobile_url: mobileUrl,
				axe_violations: r.axe ?? null,
				playwright_data: buildPlaywrightPayload(r),
			});
		}

		const finalStatus = await finalizeScanFromResults(scanId, results);

		return res.json({
			success: true,
			scanId,
			finalStatus,
			processedPages: results.length,
		});
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'unknown_error';
		console.error('[runScan] failed:', message);

		if (scanIdForCatch) {
			await markScanFailed(scanIdForCatch, message);
		}

		return res.status(500).json({ error: message });
	}
}
