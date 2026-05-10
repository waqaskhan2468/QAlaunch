export type ScanStatus = 'pending' | 'analyzing' | 'completed' | 'failed';

export type ScanStep = {
	name: string;
	ok: boolean;
	error?: string;
};

export type ConsoleMessage = {
	type: string;
	text: string;
	url?: string | null;
};

export type FailedRequest = {
	url: string;
	failure: string | null;
	method: string;
};

export type HttpError = {
	url: string;
	status: number;
};

export type LinkRecord = {
	href: string;
	text: string;
	target: string | null;
	rel: string | null;
	isExternal: boolean;
};

export type ValidatedLink = LinkRecord & {
	status: number;
	ok: boolean;
	error?: string;
};

export type LinksResult = {
	totalLinks: number;
	checkedLinks: number;
	brokenLinks: ValidatedLink[];
	links: ValidatedLink[];
};

export type ButtonRecord = {
	text: string;
	hasOnClick: boolean;
	isVisible: boolean;
	classes: string;
};

export type FormRecord = {
	action: string;
	method: string;
	inputs: {
		type: string;
		name: string;
		required: boolean;
		hasLabel: boolean;
	}[];
	submitButton: boolean;
};

export type InteractiveData = {
	buttons: ButtonRecord[];
	forms: FormRecord[];
};

export type SeoData = {
	title: string;
	metaDescription: string | null;
	metaKeywords: string | null;
	canonical: string | null;
	ogTitle: string | null;
	ogImage: string | null;
	h1Tags: string[];
	h2Count: number;
	h3Count: number;
	imagesWithoutAlt: number;
	totalImages: number;
	hasViewportMeta: boolean;
	hasFavicon: boolean;
	language: string | null;
};

// ─── Responsive ────────────────────────────────────────────────────────────

export type ResponsiveResult = {
	viewport: string;
	width: number;
	height: number;
	hasHorizontalScroll: boolean;
	screenshot: Buffer;
	/** Mobile viewports only: ordered top→bottom slices, each ≤ 844px tall */
	slices?: Buffer[];
	/** Number of slices captured (1 for desktop/tablet, 3–4 for mobile) */
	sliceCount?: number;
};

/** Stored in the DB / passed to Claude — URLs instead of Buffers */
export type ResponsivePayload = {
	viewport: string;
	width: number;
	height: number;
	hasHorizontalScroll: boolean;
	/** First slice URL (or single full-page URL for desktop/tablet) */
	screenshot_url: string | null;
	/** All slice URLs for mobile viewports; single-element for others */
	screenshot_slice_urls?: string[];
};

// ─── Screenshot upload result ──────────────────────────────────────────────

export type ScreenshotUploadResult = {
	url: string | null;
	warning?: string;
};

// ─── Scan result ───────────────────────────────────────────────────────────

export type ScanResult = {
	scanId: string;
	url: string;
	ok: boolean;
	error?: string;
	warnings: string[];
	steps: ScanStep[];
	rawHtml?: string;
	consoleMessages: ConsoleMessage[];
	failedRequests: FailedRequest[];
	httpErrors: HttpError[];
	links?: LinksResult;
	interactive?: InteractiveData;
	seoData?: SeoData;
	axe?: AxeViolation[];
	responsive?: ResponsiveResult[];
	screenshots?: {
		desktop?: Buffer;
		mobile?: Buffer;
	};
};

// ─── Axe ───────────────────────────────────────────────────────────────────

export type AxeViolation = {
	id: string;
	impact: string | null;
	description: string;
	help: string;
	helpUrl: string;
	nodes: {
		html: string;
		target: string[];
		failureSummary?: string;
	}[];
};

// ─── Request body ──────────────────────────────────────────────────────────

export type ScanRequest = {
	scanId: string;
	urls: string[];
};
