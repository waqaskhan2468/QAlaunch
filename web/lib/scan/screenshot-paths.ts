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
