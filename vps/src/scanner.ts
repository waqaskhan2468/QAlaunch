import {
	chromium,
	devices,
	type Browser,
	type ConsoleMessage,
	type Request,
	type Response,
} from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const VERCEL_CALLBACK_URL = process.env.VERCEL_CALLBACK_URL;
const VERCEL_CALLBACK_SECRET = process.env.VERCEL_CALLBACK_SECRET;

type RunScanOptions = {
	url: string;
	scanId: string;
};

type ScreenshotResult = {
	desktop: string;
	mobile: string;
};

type ConsoleMessageEntry = {
	type: string;
	text: string;
	url?: string;
};

type FailedRequestEntry = {
	url: string;
	failure?: string;
	method: string;
};

type HttpErrorEntry = {
	url: string;
	status: number;
};

type LinkEntry = {
	href: string;
	text: string;
	target: string | null;
	rel: string | null;
	isExternal: boolean;
};

type LinkCheckResult = LinkEntry & {
	status: number;
	ok: boolean;
	error?: string;
};

type InteractiveData = {
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

type SeoData = {
	title: string;
	metaDescription?: string;
	metaKeywords?: string;
	canonical?: string;
	ogTitle?: string;
	ogImage?: string;
	h1Tags: string[];
	h2Count: number;
	h3Count: number;
	imagesWithoutAlt: number;
	totalImages: number;
	hasViewportMeta: boolean;
	hasFavicon: boolean;
	language: string;
};

type AccessibilityResult = {
	violations: unknown[];
	passes: number;
	incomplete: number;
	inapplicable: number;
};

type ResponsiveResult = {
	viewport: string;
	width: number;
	height: number;
	hasHorizontalScroll: boolean;
	screenshot: string;
};

type ScanResults = {
	screenshots: ScreenshotResult;
	consoleMessages: ConsoleMessageEntry[];
	failedRequests: FailedRequestEntry[];
	httpErrors: HttpErrorEntry[];
	links: LinkCheckResult[];
	interactive: InteractiveData;
	seo: SeoData;
	accessibility: AccessibilityResult;
	responsive: ResponsiveResult[];
};

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/**
 * Run a full scan against `url` and post results back to Vercel.
 */
async function runScan({ url, scanId }: RunScanOptions): Promise<void> {
	console.log(`[${scanId}] Starting scan: ${url}`);

	const browser = await chromium.launch({ args: ['--no-sandbox'] });

	try {
		const results: Partial<ScanResults> = {};

		// 1. Screenshots (desktop + mobile)
		results.screenshots = await captureScreenshots(browser, url);
		console.log(`[${scanId}] ✓ Screenshots`);

		// 2-3. Console errors + network failures
		const { consoleMessages, failedRequests, httpErrors } =
			await captureConsoleAndNetwork(browser, url);
		results.consoleMessages = consoleMessages;
		results.failedRequests = failedRequests;
		results.httpErrors = httpErrors;
		console.log(`[${scanId}] ✓ Console & network`);

		// 4. Links
		results.links = await collectLinks(browser, url);
		console.log(`[${scanId}] ✓ Links (${results.links.length})`);

		// 5. Buttons & forms
		results.interactive = await collectInteractiveElements(browser, url);
		console.log(`[${scanId}] ✓ Buttons & forms`);

		// 6. SEO data
		results.seo = await collectSeoData(browser, url);
		console.log(`[${scanId}] ✓ SEO`);

		// 7. Accessibility (axe-core)
		results.accessibility = await runAccessibility(browser, url);
		console.log(
			`[${scanId}] ✓ Accessibility (${results.accessibility.violations.length} violations)`,
		);

		// 8. Mobile responsiveness
		results.responsive = await checkResponsiveness(browser, url);
		console.log(`[${scanId}] ✓ Responsiveness`);

		// Post results back to Vercel
		await postResults({ scanId, results, error: null });
		console.log(`[${scanId}] ✓ Results posted`);
	} catch (error: unknown) {
		console.error(`[${scanId}] Scan failed:`, error);
		await postResults({
			scanId,
			results: null,
			error: getErrorMessage(error),
		});
	} finally {
		await browser.close();
	}
}

// Collector 1: Screenshots
async function captureScreenshots(
	browser: Browser,
	url: string,
): Promise<ScreenshotResult> {
	// Desktop (1440x900)
	const desktopCtx = await browser.newContext({
		viewport: { width: 1440, height: 900 },
	});
	const desktopPage = await desktopCtx.newPage();
	await desktopPage.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
	await desktopPage.waitForTimeout(2000); // let lazy-loads settle

	const desktopScreenshot = await desktopPage.screenshot({
		fullPage: true,
		type: 'jpeg',
		quality: 75,
	});
	await desktopCtx.close();

	// Mobile (iPhone 14 emulation)
	const iPhone = devices['iPhone 14'];
	const mobileCtx = await browser.newContext({ ...iPhone });
	const mobilePage = await mobileCtx.newPage();
	await mobilePage.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
	const mobileScreenshot = await mobilePage.screenshot({ fullPage: true });
	await mobileCtx.close();

	return {
		desktop: desktopScreenshot.toString('base64'),
		mobile: mobileScreenshot.toString('base64'),
	};
}

// Collector 2-3: Console errors + network failures
async function captureConsoleAndNetwork(
	browser: Browser,
	url: string,
): Promise<{
	consoleMessages: ConsoleMessageEntry[];
	failedRequests: FailedRequestEntry[];
	httpErrors: HttpErrorEntry[];
}> {
	const ctx = await browser.newContext();
	const page = await ctx.newPage();

	const consoleMessages: ConsoleMessageEntry[] = [];
	const failedRequests: FailedRequestEntry[] = [];
	const httpErrors: HttpErrorEntry[] = [];

	page.on('console', (msg: ConsoleMessage) => {
		if (msg.type() === 'error' || msg.type() === 'warning') {
			consoleMessages.push({
				type: msg.type(),
				text: msg.text(),
				url: msg.location().url,
			});
		}
	});

	page.on('pageerror', (err: Error) => {
		consoleMessages.push({ type: 'pageerror', text: err.message });
	});

	page.on('requestfailed', (req: Request) => {
		failedRequests.push({
			url: req.url(),
			failure: req.failure()?.errorText,
			method: req.method(),
		});
	});

	page.on('response', (res: Response) => {
		if (res.status() >= 400) {
			httpErrors.push({ url: res.url(), status: res.status() });
		}
	});

	await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
	await page.waitForTimeout(1000);
	await ctx.close();

	return { consoleMessages, failedRequests, httpErrors };
}

// Collector 4: Links
async function collectLinks(
	browser: Browser,
	url: string,
): Promise<LinkCheckResult[]> {
	const ctx = await browser.newContext();
	const page = await ctx.newPage();
	await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

	const allLinks = await page.evaluate(() => {
		const anchors = Array.from(
			document.querySelectorAll('a[href]') as NodeListOf<HTMLAnchorElement>,
		);

		return anchors.map((a) => ({
			href: a.href,
			text: a.innerText.trim().substring(0, 100),
			target: a.getAttribute('target'),
			rel: a.getAttribute('rel'),
			isExternal: !a.href.startsWith(window.location.origin),
		}));
	});

	await ctx.close();

	// Validate links in parallel (HEAD requests with concurrency cap)
	const CONCURRENCY = 10;
	const results: LinkCheckResult[] = [];

	for (let i = 0; i < allLinks.length; i += CONCURRENCY) {
		const batch = allLinks.slice(i, i + CONCURRENCY);

		const batchResults = await Promise.all(
			batch.map(async (link: LinkEntry): Promise<LinkCheckResult> => {
				try {
					const res = await fetch(link.href, {
						method: 'HEAD',
						signal: AbortSignal.timeout(5000),
					});

					return { ...link, status: res.status, ok: res.ok };
				} catch (error: unknown) {
					return {
						...link,
						status: 0,
						ok: false,
						error: getErrorMessage(error),
					};
				}
			}),
		);

		results.push(...batchResults);
	}

	return results;
}

// Collector 5: Buttons & forms
async function collectInteractiveElements(
	browser: Browser,
	url: string,
): Promise<InteractiveData> {
	const ctx = await browser.newContext();
	const page = await ctx.newPage();
	await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

	const data = await page.evaluate<InteractiveData>(() => ({
		buttons: Array.from(
			document.querySelectorAll(
				'button, [role="button"]',
			) as NodeListOf<HTMLElement>,
		).map((b) => ({
			text: b.innerText.trim(),
			hasOnClick:
				typeof (b as HTMLElement & { onclick?: unknown }).onclick ===
					'function' || b.hasAttribute('onclick'),
			isVisible: b.offsetParent !== null,
			classes: b.className,
		})),
		forms: Array.from(
			document.querySelectorAll('form') as NodeListOf<HTMLFormElement>,
		).map((f) => ({
			action: f.action,
			method: f.method,
			inputs: Array.from(
				f.querySelectorAll('input, select, textarea') as NodeListOf<
					HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
				>,
			).map((i) => ({
				type: 'type' in i ? i.type : '',
				name: i.name,
				required: i.required,
				hasLabel: !!i.labels?.length,
			})),
			submitButton: !!f.querySelector('[type="submit"]'),
		})),
	}));

	await ctx.close();
	return data;
}

// Collector 6: SEO data
async function collectSeoData(browser: Browser, url: string): Promise<SeoData> {
	const ctx = await browser.newContext();
	const page = await ctx.newPage();
	await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

	const seoData = await page.evaluate<SeoData>(() => ({
		title: document.title,
		metaDescription: (
			document.querySelector(
				'meta[name="description"]',
			) as HTMLMetaElement | null
		)?.content,
		metaKeywords: (
			document.querySelector('meta[name="keywords"]') as HTMLMetaElement | null
		)?.content,
		canonical: (
			document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
		)?.href,
		ogTitle: (
			document.querySelector(
				'meta[property="og:title"]',
			) as HTMLMetaElement | null
		)?.content,
		ogImage: (
			document.querySelector(
				'meta[property="og:image"]',
			) as HTMLMetaElement | null
		)?.content,
		h1Tags: Array.from(
			document.querySelectorAll('h1') as NodeListOf<HTMLElement>,
		).map((h) => h.innerText.trim()),
		h2Count: document.querySelectorAll('h2').length,
		h3Count: document.querySelectorAll('h3').length,
		imagesWithoutAlt: document.querySelectorAll('img:not([alt])').length,
		totalImages: document.querySelectorAll('img').length,
		hasViewportMeta: !!document.querySelector('meta[name="viewport"]'),
		hasFavicon: !!document.querySelector('link[rel="icon"]'),
		language: document.documentElement.lang,
	}));

	await ctx.close();
	return seoData;
}

// Collector 7: Accessibility (axe-core)
async function runAccessibility(
	browser: Browser,
	url: string,
): Promise<AccessibilityResult> {
	const ctx = await browser.newContext();
	const page = await ctx.newPage();
	await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

	const axeResults = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
		.analyze();

	await ctx.close();

	return {
		violations: axeResults.violations,
		passes: axeResults.passes.length,
		incomplete: axeResults.incomplete.length,
		inapplicable: axeResults.inapplicable.length,
	};
}

// Collector 8: Mobile responsiveness
async function checkResponsiveness(
	browser: Browser,
	url: string,
): Promise<ResponsiveResult[]> {
	const viewports = [
		{ name: 'iPhone SE', width: 375, height: 667 },
		{ name: 'iPhone 14', width: 390, height: 844 },
		{ name: 'iPad', width: 768, height: 1024 },
	];

	const responsiveResults: ResponsiveResult[] = [];

	for (const vp of viewports) {
		const ctx = await browser.newContext({
			viewport: { width: vp.width, height: vp.height },
		});
		const page = await ctx.newPage();
		await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

		const hasHorizontalScroll = await page.evaluate(
			() =>
				document.documentElement.scrollWidth >
				document.documentElement.clientWidth,
		);

		const screenshot = await page.screenshot({ fullPage: true });

		responsiveResults.push({
			viewport: vp.name,
			width: vp.width,
			height: vp.height,
			hasHorizontalScroll,
			screenshot: screenshot.toString('base64'),
		});

		await ctx.close();
	}

	return responsiveResults;
}

// Post results back to Vercel
async function postResults({
	scanId,
	results,
	error,
}: {
	scanId: string;
	results: Partial<ScanResults> | null;
	error: string | null;
}): Promise<void> {
	if (!VERCEL_CALLBACK_URL) {
		console.warn('VERCEL_CALLBACK_URL not set - skipping callback');
		return;
	}

	const payload = {
		scanId,
		results,
		error,
		completedAt: new Date().toISOString(),
	};

	const res = await fetch(VERCEL_CALLBACK_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${VERCEL_CALLBACK_SECRET ?? ''}`,
		},
		body: JSON.stringify(payload),
		signal: AbortSignal.timeout(15000),
	});

	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Callback failed ${res.status}: ${body}`);
	}
}

export { runScan };
