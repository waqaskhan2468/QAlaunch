import sharp from 'sharp';

import { getServiceSupabase } from '@/lib/db/supabase';
import { pageElementCropPath } from '@/lib/scan/screenshot-paths';
import type { ClaudeBoundingBox } from './types';

/**
 * Evidence crops for AI findings.
 *
 * The deterministic pattern checks already upload a highlighted crop of the
 * element they fail on, and those crops are what the result page and the PDF
 * show as "screenshot evidence". AI findings only carried a bounding box in
 * the screenshot's pixel space, which the web page used as a hint to show the
 * whole page screenshot and the PDF ignored altogether — so a paid report
 * promised screenshot evidence per issue and delivered none.
 *
 * This turns a bounding box into the same kind of crop: the box region plus
 * generous padding, cut from the stored screenshot and uploaded next to it as
 * `crop-ai-<n>.jpg`. No highlight rectangle is drawn, deliberately: the model's
 * boxes are close but not exact, and a wrong red box costs more trust than a
 * crop that is merely a little off-centre.
 *
 * Best-effort throughout. A failed crop leaves the issue pointing at the full
 * screenshot, exactly as before.
 */

const SCREENSHOT_BUCKET =
	process.env.SUPABASE_SCREENSHOT_BUCKET || 'scan-screenshots';

/** Room around the box so the element is seen in context, not in isolation. */
const CROP_PAD_PX = 48;
/** Crops narrower than this look like a smear of pixels; widen to this. */
const MIN_CROP_WIDTH_PX = 320;
const MIN_CROP_HEIGHT_PX = 120;
/** A box covering most of the page is not evidence of anything in particular. */
const MAX_BOX_AREA_RATIO = 0.6;
const FETCH_TIMEOUT_MS = 8_000;
/** Whole-scan ceiling, so a 40-issue page cannot stall the pipeline. */
const MAX_CROPS_PER_SCAN = 24;

export type EvidenceCropInput = {
	scanId: string;
	pageUrl: string;
	screenshotUrl: string;
	boundingBox: ClaudeBoundingBox;
	/** Unique per issue within the scan — becomes part of the storage path. */
	cropKey: string;
};

type Dimensions = { width: number; height: number };

async function fetchBytes(url: string): Promise<Buffer | null> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	try {
		const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
		if (!res.ok) return null;
		return Buffer.from(await res.arrayBuffer());
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}

/** Pixel rectangle to cut: the box, padded, clamped to the image, never tiny. */
export function cropRegion(
	box: ClaudeBoundingBox,
	image: Dimensions,
): { left: number; top: number; width: number; height: number } | null {
	if (image.width <= 0 || image.height <= 0) return null;
	if (box.width <= 0 || box.height <= 0) return null;
	if ((box.width * box.height) / (image.width * image.height) > MAX_BOX_AREA_RATIO) {
		return null;
	}

	let left = box.x - CROP_PAD_PX;
	let top = box.y - CROP_PAD_PX;
	let width = box.width + CROP_PAD_PX * 2;
	let height = box.height + CROP_PAD_PX * 2;

	if (width < MIN_CROP_WIDTH_PX) {
		left -= (MIN_CROP_WIDTH_PX - width) / 2;
		width = MIN_CROP_WIDTH_PX;
	}
	if (height < MIN_CROP_HEIGHT_PX) {
		top -= (MIN_CROP_HEIGHT_PX - height) / 2;
		height = MIN_CROP_HEIGHT_PX;
	}

	left = Math.max(0, Math.round(left));
	top = Math.max(0, Math.round(top));
	width = Math.min(Math.round(width), image.width - left);
	height = Math.min(Math.round(height), image.height - top);

	if (width < 16 || height < 16) return null;
	return { left, top, width, height };
}

async function uploadCrop(path: string, buffer: Buffer): Promise<string | null> {
	const supabase = getServiceSupabase();
	const { error } = await supabase.storage
		.from(SCREENSHOT_BUCKET)
		.upload(path, buffer, { contentType: 'image/jpeg', upsert: true });
	if (error) return null;
	const { data } = supabase.storage.from(SCREENSHOT_BUCKET).getPublicUrl(path);
	return data?.publicUrl ?? null;
}

/**
 * Cut and upload one crop. Returns its public URL, or null when anything
 * along the way did not work out — the caller keeps the full screenshot.
 */
export async function createEvidenceCrop(
	input: EvidenceCropInput,
): Promise<string | null> {
	try {
		const bytes = await fetchBytes(input.screenshotUrl);
		if (!bytes) return null;

		const image = sharp(bytes);
		const meta = await image.metadata();
		if (!meta.width || !meta.height) return null;

		const region = cropRegion(input.boundingBox, {
			width: meta.width,
			height: meta.height,
		});
		if (!region) return null;

		const crop = await image.extract(region).jpeg({ quality: 82 }).toBuffer();
		const path = pageElementCropPath(input.scanId, input.pageUrl, input.cropKey, 'jpg');
		return await uploadCrop(path, crop);
	} catch (error) {
		console.warn('[evidence-crop] failed', {
			scanId: input.scanId,
			cropKey: input.cropKey,
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}

/**
 * Crop every issue that carries a box, a few at a time. Mutates `screenshot_url`
 * on the rows it succeeds for and returns how many it managed.
 */
export async function attachEvidenceCrops<
	T extends {
		scan_id: string;
		screenshot_url: string | null;
		bounding_box: ClaudeBoundingBox | null;
		finding_type: string;
	},
>(rows: T[], pageUrlOf: (row: T) => string | null): Promise<number> {
	const candidates = rows
		.filter(
			(row) =>
				row.finding_type !== 'verified_pattern' &&
				row.bounding_box != null &&
				typeof row.screenshot_url === 'string' &&
				row.screenshot_url.length > 0 &&
				!row.screenshot_url.includes('/crop-'),
		)
		.slice(0, MAX_CROPS_PER_SCAN);

	let done = 0;
	const CONCURRENCY = 3;
	for (let i = 0; i < candidates.length; i += CONCURRENCY) {
		const batch = candidates.slice(i, i + CONCURRENCY);
		const urls = await Promise.all(
			batch.map((row, j) => {
				const pageUrl = pageUrlOf(row);
				if (!pageUrl || !row.bounding_box || !row.screenshot_url) return null;
				return createEvidenceCrop({
					scanId: row.scan_id,
					pageUrl,
					screenshotUrl: row.screenshot_url,
					boundingBox: row.bounding_box,
					cropKey: `ai-${i + j}`,
				});
			}),
		);
		batch.forEach((row, j) => {
			const url = urls[j];
			if (url) {
				row.screenshot_url = url;
				done += 1;
			}
		});
	}
	return done;
}
