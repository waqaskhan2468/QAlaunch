import { chromium, devices, type BrowserContext, type Page } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import type {
	LinkRecord,
	ValidatedLink,
	ScanStep,
	ScanResult,
} from '../types/scan.types';

// CONFIG
const MAX_LINKS = 200;
const LINK_TIMEOUT = 5_000;
const NAV_TIMEOUT = 30_000;
const EXTRA_WAIT_MS = 2_000;

function cleanError(err: unknown): string {
	const msg = err instanceof Error ? err.message : String(err);
	return msg.replace(/\u001b\[[0-9;]*m/g, '').trim();
}

function normalizeLink(baseUrl: string, href: string): string | null {
	try {
		return new URL(href, baseUrl).href;
	} catch {
		return null;
	}
}

function addStep(steps: ScanStep[], name: string, ok: boolean, error?: string) {
	steps.push({ name, ok, ...(error ? { error } : {}) });
}

async function closeContext(ctx: BrowserContext | null) {
	if (!ctx) return;
	try {
		await ctx.close();
	} catch {
		// ignore
	}
}

async function requestWithTimeout(url: string, method: 'HEAD' | 'GET') {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), LINK_TIMEOUT);

	try {
		const res = await fetch(url, {
			method,
			signal: controller.signal,
			redirect: 'follow',
		});
		return { status: res.status, ok: res.ok };
	} finally {
		clearTimeout(timeout);
	}
}

async function validateLink(link: LinkRecord): Promise<ValidatedLink> {
	try {
		let res = await requestWithTimeout(link.href, 'HEAD');
		if (res.status === 405 || res.status === 501) {
			res = await requestWithTimeout(link.href, 'GET');
		}
		return { ...link, status: res.status, ok: res.ok };
	} catch (e) {
		return {
			...link,
			status: 0,
			ok: false,
			error: cleanError(e),
		};
	}
}

async function safeGoto(
	page: Page,
	url: string,
): Promise<{ strategy: string; warning?: string }> {
	try {
		await page.goto(url, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT });
		await page.waitForTimeout(EXTRA_WAIT_MS);
		return { strategy: 'networkidle' };
	} catch (e1) {
		try {
			await page.goto(url, {
				waitUntil: 'domcontentloaded',
				timeout: NAV_TIMEOUT,
			});
			await page.waitForTimeout(EXTRA_WAIT_MS);
			return {
				strategy: 'domcontentloaded',
				warning: `networkidle timeout, fallback used: ${cleanError(e1)}`,
			};
		} catch (e2) {
			await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT });
			await page.waitForTimeout(EXTRA_WAIT_MS);
			return {
				strategy: 'load',
				warning: `networkidle/domcontentloaded failed, fallback used: ${cleanError(e2)}`,
			};
		}
	}
}

async function collectResponsive(browser: any, url: string) {
	const viewports = [
		{ name: 'iPhone SE', width: 375, height: 667 },
		{ name: 'iPhone 14', width: 390, height: 844 },
		{ name: 'iPad', width: 768, height: 1024 },
	];

	const output: Array<{
		viewport: string;
		hasHorizontalScroll: boolean;
		screenshot: string;
	}> = [];

	for (const vp of viewports) {
		const ctx = await browser.newContext({
			viewport: { width: vp.width, height: vp.height },
		});
		const p = await ctx.newPage();

		try {
			await safeGoto(p, url);

			const hasHorizontalScroll = await p.evaluate(
				() =>
					document.documentElement.scrollWidth >
					document.documentElement.clientWidth,
			);

			const screenshot = await p.screenshot({
				fullPage: true,
				type: 'jpeg',
				quality: 70,
			});

			output.push({
				viewport: vp.name,
				hasHorizontalScroll,
				screenshot: screenshot.toString('base64'),
			});
		} finally {
			await closeContext(ctx);
		}
	}

	return output;
}

export async function runPlaywrightScan(
	urls: string[],
	scanId: string,
): Promise<ScanResult[]> {
	const browser = await chromium.launch({ headless: true });
	const results: ScanResult[] = [];

	try {
		for (const url of urls) {
			let context: BrowserContext | null = null;
			let mobileCtx: BrowserContext | null = null;

			const warnings: string[] = [];
			const steps: ScanStep[] = [];
			const consoleMessages: ScanResult['consoleMessages'] = [];
			const failedRequests: ScanResult['failedRequests'] = [];
			const httpErrors: ScanResult['httpErrors'] = [];

			const result: ScanResult = {
				scanId,
				url,
				ok: false,
				warnings,
				steps,
				consoleMessages,
				failedRequests,
				httpErrors,
			};

			try {
				context = await browser.newContext();
				const page = await context.newPage();

				page.on('console', (msg) => {
					if (msg.type() === 'error' || msg.type() === 'warning') {
						consoleMessages.push({
							type: msg.type(),
							text: msg.text(),
							url: msg.location()?.url ?? null,
						});
					}
				});

				page.on('pageerror', (err) => {
					consoleMessages.push({ type: 'pageerror', text: err.message });
				});

				page.on('requestfailed', (req) => {
					failedRequests.push({
						url: req.url(),
						failure: req.failure()?.errorText ?? null,
						method: req.method(),
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

				try {
					const nav = await safeGoto(page, url);
					if (nav.warning) warnings.push(nav.warning);
					addStep(steps, `navigate:${nav.strategy}`, true);
				} catch (e) {
					const msg = cleanError(e);
					addStep(steps, 'navigate', false, msg);
					throw new Error(`Navigation failed: ${msg}`);
				}

				result.screenshots = {};

				try {
					await page.setViewportSize({ width: 1440, height: 900 });
					const desktopShot = await page.screenshot({
						fullPage: true,
						type: 'jpeg',
						quality: 75,
					});
					result.screenshots.desktop = desktopShot.toString('base64');
					addStep(steps, 'screenshot:desktop', true);
				} catch (e) {
					addStep(steps, 'screenshot:desktop', false, cleanError(e));
				}

				try {
					const iPhone = devices['iPhone 14'];
					mobileCtx = await browser.newContext({ ...iPhone });
					const mobilePage = await mobileCtx.newPage();

					const nav = await safeGoto(mobilePage, url);
					if (nav.warning) warnings.push(`mobile ${nav.warning}`);

					const mobileShot = await mobilePage.screenshot({
						fullPage: true,
						type: 'jpeg',
						quality: 75,
					});
					result.screenshots.mobile = mobileShot.toString('base64');
					addStep(steps, 'screenshot:mobile', true);
				} catch (e) {
					addStep(steps, 'screenshot:mobile', false, cleanError(e));
				}

				try {
					const rawLinks = await page.evaluate(() => {
						const origin = window.location.origin;
						return Array.from(document.querySelectorAll('a[href]'))
							.map((a) => {
								const hrefAttr = (a.getAttribute('href') || '').trim();
								if (!hrefAttr) return null;
								if (
									hrefAttr.startsWith('#') ||
									hrefAttr.startsWith('javascript:') ||
									hrefAttr.startsWith('mailto:') ||
									hrefAttr.startsWith('tel:')
								) {
									return null;
								}
								return {
									href: hrefAttr,
									text: (a.textContent || '').trim().slice(0, 100),
									target: a.getAttribute('target'),
									rel: a.getAttribute('rel'),
									origin,
								};
							})
							.filter(Boolean) as Array<{
							href: string;
							text: string;
							target: string | null;
							rel: string | null;
							origin: string;
						}>;
					});

					const normalizedLinks: LinkRecord[] = rawLinks
						.map((link) => {
							const normalized = normalizeLink(url, link.href);
							if (!normalized) return null;
							return {
								href: normalized,
								text: link.text,
								target: link.target,
								rel: link.rel,
								isExternal: !normalized.startsWith(link.origin),
							};
						})
						.filter((l): l is LinkRecord => l !== null);

					const uniqueLinks = Array.from(
						new Map(normalizedLinks.map((l) => [l.href, l])).values(),
					);
					const limited = uniqueLinks.slice(0, MAX_LINKS);
					const validated = await Promise.all(limited.map(validateLink));

					result.links = {
						totalLinks: uniqueLinks.length,
						checkedLinks: validated.length,
						brokenLinks: validated.filter((l) => !l.ok),
						links: validated,
					};

					addStep(steps, 'links', true);
				} catch (e) {
					addStep(steps, 'links', false, cleanError(e));
				}

				try {
					result.interactive = await page.evaluate(() => {
						const buttons = Array.from(
							document.querySelectorAll('button, [role="button"]'),
						).map((b) => {
							const el = b as HTMLElement & { onclick?: any };
							return {
								text: (el.innerText || el.textContent || '').trim(),
								hasOnClick: !!el.onclick || el.hasAttribute('onclick'),
								isVisible: el.offsetParent !== null,
								classes: el.className || '',
							};
						});

						const forms = Array.from(document.querySelectorAll('form')).map(
							(f) => {
								const form = f as HTMLFormElement;
								const inputs = Array.from(
									form.querySelectorAll('input, select, textarea'),
								).map((i) => {
									const field = i as
										| HTMLInputElement
										| HTMLSelectElement
										| HTMLTextAreaElement;
									return {
										type:
											(field as HTMLInputElement).type ||
											field.tagName.toLowerCase(),
										name: field.name || '',
										required: !!field.required,
										hasLabel: !!field.labels?.length,
									};
								});

								return {
									action: form.action || '',
									method: (form.method || 'get').toLowerCase(),
									inputs,
									submitButton: !!form.querySelector('[type="submit"]'),
								};
							},
						);

						return { buttons, forms };
					});

					addStep(steps, 'interactive', true);
				} catch (e) {
					addStep(steps, 'interactive', false, cleanError(e));
				}

				try {
					result.seoData = await page.evaluate(() => ({
						title: document.title,
						metaDescription:
							document
								.querySelector('meta[name="description"]')
								?.getAttribute('content') ?? null,
						metaKeywords:
							document
								.querySelector('meta[name="keywords"]')
								?.getAttribute('content') ?? null,
						canonical:
							document
								.querySelector('link[rel="canonical"]')
								?.getAttribute('href') ?? null,
						ogTitle:
							document
								.querySelector('meta[property="og:title"]')
								?.getAttribute('content') ?? null,
						ogImage:
							document
								.querySelector('meta[property="og:image"]')
								?.getAttribute('content') ?? null,
						h1Tags: Array.from(document.querySelectorAll('h1')).map((h) =>
							(h.textContent || '').trim(),
						),
						h2Count: document.querySelectorAll('h2').length,
						h3Count: document.querySelectorAll('h3').length,
						imagesWithoutAlt:
							document.querySelectorAll('img:not([alt])').length,
						totalImages: document.querySelectorAll('img').length,
						hasViewportMeta: !!document.querySelector('meta[name="viewport"]'),
						hasFavicon:
							!!document.querySelector('link[rel="icon"]') ||
							!!document.querySelector('link[rel="shortcut icon"]'),
						language: document.documentElement.lang || null,
					}));
					addStep(steps, 'seo', true);
				} catch (e) {
					addStep(steps, 'seo', false, cleanError(e));
				}

				try {
					const axeResults = await new AxeBuilder({ page })
						.withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
						.analyze();

					result.axe = axeResults.violations;
					addStep(steps, 'axe', true);
				} catch (e) {
					addStep(steps, 'axe', false, cleanError(e));
				}

				try {
					result.responsive = await collectResponsive(browser, url);
					addStep(steps, 'responsive', true);
				} catch (e) {
					addStep(steps, 'responsive', false, cleanError(e));
				}

				result.ok = steps.some((s) => s.name.startsWith('navigate') && s.ok);
			} catch (e) {
				result.ok = false;
				result.error = cleanError(e);
			} finally {
				await closeContext(mobileCtx);
				await closeContext(context);
			}

			results.push(result);
		}
	} finally {
		await browser.close();
	}

	return results;
}
