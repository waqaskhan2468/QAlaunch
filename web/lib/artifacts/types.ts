/** JSON-safe responsive metadata (no screenshot buffers). */
export type ResponsiveArtifactMeta = {
	viewport: string;
	width: number;
	height: number;
	hasHorizontalScroll: boolean;
	sliceCount?: number;
};

/** JSON-serializable output of the browser step, returned from `scan-browser:{slug}`. */
export type PageBrowserStepResult = {
	scanId: string;
	pageUrl: string;
	scanOk: boolean;
	screenshotDesktopUrl: string | null;
	screenshotMobileUrl: string | null;
};
