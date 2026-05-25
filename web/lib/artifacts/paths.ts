import { urlHash } from '@/lib/utils/url';

export function pageArtifactKey(scanId: string, pageUrl: string): string {
	return urlHash(`${scanId}:${pageUrl}`);
}

export function pageArtifactPrefix(scanId: string, pageUrl: string): string {
	return `scans/${scanId}/pages/${pageArtifactKey(scanId, pageUrl)}`;
}

export function pageArtifactJsonPath(scanId: string, pageUrl: string): string {
	return `${pageArtifactPrefix(scanId, pageUrl)}/artifact.json`;
}

export function pageArtifactSlicePath(
	scanId: string,
	pageUrl: string,
	sliceName: string,
): string {
	return `${pageArtifactPrefix(scanId, pageUrl)}/slices/${sliceName}.json`;
}

export function pageDesktopScreenshotPath(
	scanId: string,
	pageUrl: string,
	extension: 'jpg' | 'png',
): string {
	return `${pageArtifactPrefix(scanId, pageUrl)}/desktop.${extension}`;
}


export function pageMobileScreenshotPath(
	scanId: string,
	pageUrl: string,
	extension: 'jpg' | 'png',
): string {
	return `${pageArtifactPrefix(scanId, pageUrl)}/mobile.${extension}`;
}
