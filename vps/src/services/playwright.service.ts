import { chromium, devices } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

// =========================
// CONFIG
// =========================
const MAX_LINKS = 50;
const LINK_TIMEOUT = 5000;

// =========================
// HELPERS
// =========================
function normalizeLink(baseUrl: string, href: string) {
	try {
		return new URL(href, baseUrl).href;
	} catch {
		return null;
	}
}

async function validateLink(link: any) {
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), LINK_TIMEOUT);

		const res = await fetch(link.href, {
			method: 'GET',
			signal: controller.signal,
		});

		clearTimeout(timeout);

		return {
			...link,
			status: res.status,
			ok: res.ok,
		};
	} catch (e: any) {
		return {
			...link,
			status: 0,
			ok: false,
			error: e.message,
		};
	}
}

// =========================
// MAIN SERVICE
// =========================
export async function runPlaywrightScan(urls: string[]) {
	const browser = await chromium.launch({ headless: true });

	const results: any[] = [];

	for (const url of urls) {
		const context = await browser.newContext();
		const page = await context.newPage();

		const consoleMessages: any[] = [];
		const failedRequests: any[] = [];
		const httpErrors: any[] = [];

		try {
			// =========================
			// EVENT LISTENERS
			// =========================
			page.on('console', (msg) => {
				if (['error', 'warning'].includes(msg.type())) {
					consoleMessages.push({
						type: msg.type(),
						text: msg.text(),
					});
				}
			});

			page.on('pageerror', (err) => {
				consoleMessages.push({
					type: 'pageerror',
					text: err.message,
				});
			});

			page.on('requestfailed', (req) => {
				failedRequests.push({
					url: req.url(),
					error: req.failure()?.errorText,
				});
			});

			page.on('response', (res) => {
				if (res.status() >= 400) {
					httpErrors.push({
						url: res.url(),
						status: res.status(),
					});
				}
			});

			// =========================
			// NAVIGATION
			// =========================
			await page.goto(url, {
				waitUntil: 'networkidle',
				timeout: 30000,
			});

			await page.waitForTimeout(2000);

			// =========================
			// SCREENSHOTS
			// =========================
			await page.setViewportSize({ width: 1440, height: 900 });

			const desktopScreenshot = await page.screenshot({
				fullPage: true,
				type: 'jpeg',
				quality: 70,
			});

			const iPhone = devices['iPhone 14'];
			const mobileCtx = await browser.newContext({ ...iPhone });
			const mobilePage = await mobileCtx.newPage();

			await mobilePage.goto(url, { waitUntil: 'networkidle' });

			const mobileScreenshot = await mobilePage.screenshot({
				fullPage: true,
			});

			// =========================
			// LINKS (FIXED)
			// =========================
			const rawLinks = await page.evaluate(() => {
				try {
					return Array.from(document.querySelectorAll('a[href]'))
						.map((a) => {
							const href = a.getAttribute('href') || '';
							const text = (a.textContent || '').trim().slice(0, 100);

							return {
								href: href.trim(),
								text,
								target: a.getAttribute('target'),
								rel: a.getAttribute('rel'),
							};
						})
						.filter((link) => {
							if (!link.href) return false;

							if (
								link.href.startsWith('#') ||
								link.href.startsWith('javascript:') ||
								link.href.startsWith('mailto:') ||
								link.href.startsWith('tel:')
							) {
								return false;
							}

							return true;
						});
				} catch {
					return [];
				}
			});

			const normalizedLinks = rawLinks
				.map((link) => ({
					...link,
					href: normalizeLink(url, link.href),
				}))
				.filter((l) => l.href !== null);

			const limitedLinks = normalizedLinks.slice(0, MAX_LINKS);

			const validatedLinks = await Promise.all(limitedLinks.map(validateLink));

			const linkData = {
				totalLinks: normalizedLinks.length,
				checkedLinks: validatedLinks.length,
				brokenLinks: validatedLinks.filter((l) => !l.ok),
				links: validatedLinks,
			};

			// =========================
			// SEO DATA
			// =========================
			const seoData = await page.evaluate(() => ({
				title: document.title,
				metaDescription: document
					.querySelector('meta[name="description"]')
					?.getAttribute('content'),
				h1Tags: Array.from(document.querySelectorAll('h1')).map((h) =>
					h.textContent?.trim(),
				),
				imagesWithoutAlt: document.querySelectorAll('img:not([alt])').length,
				totalImages: document.querySelectorAll('img').length,
			}));

			// =========================
			// ACCESSIBILITY
			// =========================
			const axeResults = await new AxeBuilder({ page }).analyze();

			// =========================
			// RESPONSIVENESS
			// =========================
			const viewports = [
				{ name: 'mobile', width: 375, height: 667 },
				{ name: 'tablet', width: 768, height: 1024 },
			];

			const responsiveResults: any[] = [];

			for (const vp of viewports) {
				const ctx = await browser.newContext({ viewport: vp });
				const p = await ctx.newPage();

				await p.goto(url, { waitUntil: 'networkidle' });

				const hasOverflow = await p.evaluate(
					() =>
						document.documentElement.scrollWidth >
						document.documentElement.clientWidth,
				);

				responsiveResults.push({
					viewport: vp.name,
					hasHorizontalScroll: hasOverflow,
				});

				await ctx.close();
			}

			// =========================
			// FINAL RESULT
			// =========================
			results.push({
				url,
				screenshots: {
					desktop: desktopScreenshot.toString('base64'),
					mobile: mobileScreenshot.toString('base64'),
				},
				consoleMessages,
				failedRequests,
				httpErrors,
				links: linkData,
				seoData,
				axe: axeResults.violations,
				responsive: responsiveResults,
			});

			await mobileCtx.close();
			await context.close();
		} catch (error: any) {
			results.push({
				url,
				error: error.message,
			});

			await context.close();
		}
	}

	await browser.close();

	return results;
}
