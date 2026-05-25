import type { ScanStep } from '@/lib/scan/types/scan.types';

export type PageArtifactStatus = 'ok' | 'partial' | 'failed';

/** JSON-safe responsive metadata (no screenshot buffers). */
export type ResponsiveArtifactMeta = {
	viewport: string;
	width: number;
	height: number;
	hasHorizontalScroll: boolean;
	sliceCount?: number;
};

/** Durable page scan output stored in object storage (source of truth). */
export type RawPageArtifact = {
	version: 1;
	scanId: string;
	pageUrl: string;
	status: PageArtifactStatus;
	reason?: string;
	scanOk: boolean;

	timings: {
		startedAt: string;
		finishedAt: string;
		durationMs: number;
	};

	screenshots: {
		desktopPath: string | null;
		mobilePath: string | null;
		desktopPublicUrl: string | null;
		mobilePublicUrl: string | null;
	};

	accessibility: unknown | null;
	seo: unknown | null;
	links: unknown | null;
	interactive: unknown | null;
	brokenStates: unknown | null;
	responseSecurity: unknown | null;
	responsive: ResponsiveArtifactMeta[] | null;

	diagnostics: {
		steps: ScanStep[];
		warnings: string[];
		consoleMessages: unknown[];
		failedRequests: unknown[];
		httpErrors: unknown[];
		error?: string;
	};
};

/** JSON-serializable output of the browser step, returned from `scan-browser:{slug}` step. */
export type PageBrowserStepResult = {
	scanId: string;
	pageUrl: string;
	artifactPath: string;
	artifactStatus: PageArtifactStatus;
	scanOk: boolean;
	screenshotDesktopUrl: string | null;
	screenshotMobileUrl: string | null;
};

export type ArtifactSliceName =
	| 'seo'
	| 'links'
	| 'interactive'
	| 'broken_states'
	| 'accessibility'
	| 'responsive'
	| 'response_security';
