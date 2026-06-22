import { urlHash } from '@/lib/utils/url';

function pageStorageKey(scanId: string, pageUrl: string): string {
	return urlHash(`${scanId}:${pageUrl}`);
}

function pageStoragePrefix(scanId: string, pageUrl: string): string {
	return `scans/${scanId}/pages/${pageStorageKey(scanId, pageUrl)}`;
}

export function pageDesktopScreenshotPath(
	scanId: string,
	pageUrl: string,
	extension: 'jpg' | 'png',
): string {
	return `${pageStoragePrefix(scanId, pageUrl)}/desktop.${extension}`;
}

export function pageMobileScreenshotPath(
	scanId: string,
	pageUrl: string,
	extension: 'jpg' | 'png',
): string {
	return `${pageStoragePrefix(scanId, pageUrl)}/mobile.${extension}`;
}

/** Per-check evidence crop (highlighted element) for a deterministic finding. */
export function pageElementCropPath(
	scanId: string,
	pageUrl: string,
	checkId: string,
	extension: 'jpg' | 'png',
): string {
	const safe = checkId.replace(/[^a-z0-9-]/gi, '-').slice(0, 40);
	return `${pageStoragePrefix(scanId, pageUrl)}/crop-${safe}.${extension}`;
}
