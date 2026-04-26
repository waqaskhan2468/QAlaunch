export interface ScanRequest {
	scanId: string;
	urls: string[];
}

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

export type ScanStep = {
	name: string;
	ok: boolean;
	error?: string;
};

export type ResponsiveResult = {
	viewport: string;
	width: number;
	height: number;
	hasHorizontalScroll: boolean;
	screenshot: Buffer; // temporary binary image from Playwright
};

export type ResponsivePayload = {
	viewport: string;
	width: number;
	height: number;
	hasHorizontalScroll: boolean;
	screenshot_url: string | null; // saved URL for DB/Claude
};

export type ScanResult = {
	scanId: string;
	url: string;
	ok: boolean;
	error?: string;
	warnings: string[];
	steps: ScanStep[];
	screenshots?: {
		desktop?: Buffer;
		mobile?: Buffer;
	};
	consoleMessages: Array<{ type: string; text: string; url?: string | null }>;
	failedRequests: Array<{
		url: string;
		failure: string | null;
		method: string;
	}>;
	httpErrors: Array<{ url: string; status: number }>;
	links?: {
		totalLinks: number;
		checkedLinks: number;
		brokenLinks: ValidatedLink[];
		links: ValidatedLink[];
	};
	interactive?: {
		buttons: Array<{
			text: string;
			hasOnClick: boolean;
			isVisible: boolean;
			classes: string;
		}>;
		forms: Array<{
			action: string;
			method: string;
			inputs: Array<{
				type: string;
				name: string;
				required: boolean;
				hasLabel: boolean;
			}>;
			submitButton: boolean;
		}>;
	};
	seoData?: {
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
	axe?: any[];
	responsive?: ResponsiveResult[];
};
