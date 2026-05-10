import sharp from 'sharp';

export type ImageCompressionProfile = 'desktop' | 'responsive';

type CompressionResult = {
	buffer: Buffer;
	contentType: 'image/png' | 'image/jpeg';
	extension: 'png' | 'jpg';
	compressed: boolean;
};

const DESKTOP_JPEG_QUALITY = 82;
const RESPONSIVE_JPEG_QUALITY = 72;
const MIN_BYTES_FOR_COMPRESSION = 30 * 1024; // skip tiny files
const DEFAULT_MAX_DESKTOP_DIMENSION_PX = 4096;
const DEFAULT_MAX_RESPONSIVE_DIMENSION_PX = 2048;
const ABSOLUTE_MAX_IMAGE_DIMENSION_PX = 7600;

function parseDimension(raw: string | undefined, fallback: number): number {
	const value = Number.parseInt(raw ?? '', 10);
	if (!Number.isFinite(value) || value < 512) return fallback;
	return Math.min(ABSOLUTE_MAX_IMAGE_DIMENSION_PX, value);
}

function getProfileSettings(profile: ImageCompressionProfile): {
	quality: number;
	maxDimensionPx: number;
} {
	const globalDimension = parseDimension(
		process.env.SCAN_IMAGE_MAX_DIMENSION_PX,
		DEFAULT_MAX_DESKTOP_DIMENSION_PX,
	);

	if (profile === 'responsive') {
		return {
			quality: RESPONSIVE_JPEG_QUALITY,
			maxDimensionPx: parseDimension(
				process.env.SCAN_IMAGE_MAX_DIMENSION_RESPONSIVE_PX,
				globalDimension === DEFAULT_MAX_DESKTOP_DIMENSION_PX ?
					DEFAULT_MAX_RESPONSIVE_DIMENSION_PX
				:	globalDimension,
			),
		};
	}

	return {
		quality: DESKTOP_JPEG_QUALITY,
		maxDimensionPx: parseDimension(
			process.env.SCAN_IMAGE_MAX_DIMENSION_DESKTOP_PX,
			globalDimension,
		),
	};
}

/**
 * Compress screenshot buffers before storage upload.
 *
 * Best-practice defaults:
 * - Responsive/mobile assets use stronger JPEG compression for token/storage wins.
 * - Desktop uses milder JPEG compression to preserve text/UI clarity.
 * - Small images are left untouched to avoid quality loss for tiny savings.
 *
 * Fails open: if optimization throws, caller can upload original bytes.
 */
export async function compressScreenshotBuffer(
	input: Buffer,
	profile: ImageCompressionProfile,
): Promise<CompressionResult> {
	const { quality, maxDimensionPx } = getProfileSettings(profile);
	const baseImage = sharp(input).rotate();
	const metadata = await baseImage.metadata();
	const width = metadata.width ?? 0;
	const height = metadata.height ?? 0;
	const needsResizeForClaude =
		width > maxDimensionPx || height > maxDimensionPx;

	if (input.length < MIN_BYTES_FOR_COMPRESSION && !needsResizeForClaude) {
		return {
			buffer: input,
			contentType: 'image/png',
			extension: 'png',
			compressed: false,
		};
	}

	const output = await baseImage
		.resize({
			width: maxDimensionPx,
			height: maxDimensionPx,
			fit: 'inside',
			withoutEnlargement: true,
		})
		.jpeg({
			quality,
			mozjpeg: true,
			chromaSubsampling: '4:2:0',
		})
		.toBuffer();

	// If resize was required for Claude limits, always keep output regardless
	// of file size so dimensions remain API-safe.
	if (!needsResizeForClaude && (!output.length || output.length >= input.length)) {
		return {
			buffer: input,
			contentType: 'image/png',
			extension: 'png',
			compressed: false,
		};
	}

	return {
		buffer: output,
		contentType: 'image/jpeg',
		extension: 'jpg',
		compressed: true,
	};
}
