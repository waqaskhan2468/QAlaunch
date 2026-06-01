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
	/** Optional vertical slices (legacy); mobile uses one full-page `screenshot` */
	slices?: Buffer[];
	/** Number of image assets for this viewport (1 for full-page mobile/desktop) */
	sliceCount?: number;
};

// ─── Screenshot upload result ──────────────────────────────────────────────

export type ScreenshotUploadResult = {
	url: string | null;
	warning?: string;
};

// ─── Programmatic QA (broken states, …) ───────────────────────────────────

export type ProgrammaticSeverity = 'critical' | 'major' | 'minor' | 'info';

export type ProgrammaticCategory =
	| 'layout'
	| 'broken-state'
	| 'interaction'
	| 'performance'
	| 'ux'
	| 'accessibility';

export type ProgrammaticElementRef = {
	selectorHint: string;
	tag?: string;
	rect?: { x: number; y: number; w: number; h: number };
};

export type ProgrammaticFinding = {
	id: string;
	severity: ProgrammaticSeverity;
	category: ProgrammaticCategory;
	title: string;
	summary: string;
	elements?: ProgrammaticElementRef[];
	evidence?: Record<string, unknown>;
};

export type ProgrammaticPayload = {
	findings: ProgrammaticFinding[];
	stats: {
		durationMs: number;
		findingsCount: number;
		truncated?: boolean;
		rulesetVersion: string;
	};
};

export type ProgrammaticRollup = {
	rulesetVersion: string;
	totalFindings: number;
	bySeverity: {
		critical: number;
		major: number;
		minor: number;
		info: number;
	};
	topFindings: ProgrammaticFinding[];
};

/** Main document response snapshot (HTTPS, status, security headers). Read-only. */
export type ResponseSecurityMeta = {
	requestedUrl: string;
	finalUrl: string;
	protocolIsHttps: boolean;
	httpStatus: number | null;
	headersPresent: {
		strictTransportSecurity: boolean;
		contentSecurityPolicy: boolean;
		xFrameOptions: boolean;
		xContentTypeOptions: boolean;
		referrerPolicy: boolean;
		permissionsPolicy: boolean;
	};
	headerSamples: {
		strictTransportSecurity: string | null;
		contentSecurityPolicy: string | null;
		xFrameOptions: string | null;
		xContentTypeOptions: string | null;
		referrerPolicy: string | null;
		permissionsPolicy: string | null;
		server: string | null;
		xPoweredBy: string | null;
	};
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
	/** Stuck loading, bad text tokens, empty lists, etc. */
	brokenStates?: ProgrammaticPayload;
	responseSecurityMeta?: ResponseSecurityMeta;
	/** Active interaction tests: 404, form validation, search, CTA, nav links. */
	interactionTests?: import('@/lib/scan/services/interactionTests').InteractionTestsPayload;
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
	url: string;
	package: string;
};
