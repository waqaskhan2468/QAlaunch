import {
	devices,
	type Browser,
	type BrowserContext,
	type Page,
} from 'playwright-core';
import { closeContext, safeGoto } from './navigation';

// ─── Viewport & Quality ────────────────────────────────────────────────────

const DESKTOP_VIEWPORT = { width: 1440, height: 900 };

// ─── Mobile slicing ────────────────────────────────────────────────────────
//
// Claude's vision engine downscales any image whose longest edge exceeds
// 1568px. A typical mobile full-page screenshot is 3000–5000px tall, which
// renders as an unreadable blob after downscale.
//
// Fix: capture overlapping slices of ≤ 844px each so Claude sees pixel-perfect UI.
//
const MOBILE_SLICE_HEIGHT = 844; // matches iPhone 14 viewport height
const SLICE_OVERLAP_PX = 180; // large overlap so seam content is never clipped
const MAX_MOBILE_SLICES = 4; // 4 × 664px step = ~2660px coverage

// ─── Timing (all values tuned for fast-but-reliable captures) ──────────────
//
// Previous values were overly defensive and added 25–30 s of dead wait per page.
// The new values are roughly half; pages that genuinely need more time still get
// it because every function is non-fatal on timeout.
//
const AFTER_SCROLL_DELAY_MS = 300; // was 600
const AFTER_ANIMATE_DELAY_MS = 200; // was 300
const AFTER_MEDIA_READY_DELAY_MS = 150; // was 350
const NETWORK_IDLE_TIMEOUT_MS = 4_000; // was 8 000
const NETWORK_IDLE_FAST_MS = 2_000;
const FONTS_TIMEOUT_MS = 3_000; // was 5 000
const LAYOUT_SETTLE_TIMEOUT_MS = 1_000; // was 2 000
const VISIBLE_CONTENT_TIMEOUT_MS = 2_000; // was 4 000
const SLICE_SCROLL_SETTLE_MS = 60; // was 80
const MEDIA_READY_TIMEOUT_MS = 3_000; // was 6 000

// ─── CSS injected into every page before screenshot ────────────────────────

const DISABLE_ANIMATIONS_CSS = `
  *, *::before, *::after {
    animation-duration:        0s !important;
    animation-delay:           0s !important;
    transition-duration:       0s !important;
    transition-delay:          0s !important;
    scroll-behavior:           auto !important;
  }
`;

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Wait for the network to go idle, but don't hard-fail if it times out —
 * some pages have long-polling requests that never fully settle.
 */
async function waitForNetworkIdle(page: Page): Promise<void> {
	try {
		await page.waitForLoadState('networkidle', {
			timeout: NETWORK_IDLE_TIMEOUT_MS,
		});
	} catch {
		// Non-fatal: page content is usually ready even if some request lingers
	}
}

/**
 * Block until document.fonts.ready resolves, with a hard timeout cap.
 * Prevents blurry/fallback fonts in screenshots used for AI analysis.
 */
async function waitForFontsReady(page: Page): Promise<void> {
	try {
		await page.evaluate(
			(timeout: number) =>
				Promise.race([
					document.fonts.ready,
					new Promise<void>((resolve) => setTimeout(resolve, timeout)),
				]),
			FONTS_TIMEOUT_MS,
		);
	} catch {
		// Non-fatal
	}
}

/**
 * Inject CSS that kills animations and transitions so the screenshot
 * captures a stable, fully-rendered UI state.
 */
async function disableAnimations(page: Page): Promise<void> {
	try {
		await page.addStyleTag({ content: DISABLE_ANIMATIONS_CSS });
		await page.waitForTimeout(AFTER_ANIMATE_DELAY_MS);
	} catch {
		// Non-fatal: worst case we get an animated frame
	}
}

/**
 * Wait until document height stabilizes across a few checks.
 */
async function waitForLayoutStable(page: Page): Promise<void> {
	try {
		await page.evaluate(
			async ({ maxWaitMs }: { maxWaitMs: number }) => {
				const start = Date.now();
				let stableChecks = 0;
				let lastHeight = -1;

				while (Date.now() - start < maxWaitMs) {
					const height = Math.max(
						document.body.scrollHeight,
						document.documentElement.scrollHeight,
					);

					if (height === lastHeight) {
						stableChecks += 1;
					} else {
						stableChecks = 0;
						lastHeight = height;
					}

					if (stableChecks >= 3) return;

					await new Promise((resolve) => setTimeout(resolve, 100));
				}
			},
			{ maxWaitMs: LAYOUT_SETTLE_TIMEOUT_MS },
		);
	} catch {
		// Non-fatal
	}
}

/**
 * Force common hidden-on-load elements visible before capture.
 */
async function forceRevealLikelyHiddenContent(page: Page): Promise<void> {
	try {
		await page.evaluate(() => {
			const selectors = [
				'[data-aos]',
				'[data-reveal]',
				'[data-animate]',
				'[class*="reveal"]',
				'[class*="fade"]',
				'[class*="animate"]',
				'[class*="motion"]',
				'[style*="opacity: 0"]',
			];

			document
				.querySelectorAll<HTMLElement>(selectors.join(','))
				.forEach((el) => {
					el.style.opacity = '1';
					el.style.visibility = 'visible';
					el.style.transform = 'none';
					el.style.filter = 'none';
				});
		});
	} catch {
		// Non-fatal
	}
}

/**
 * Heuristic to detect likely blank content regions in mobile captures.
 */
async function hasLikelyBlankMainContent(page: Page): Promise<boolean> {
	try {
		return await page.evaluate(() => {
			const root =
				document.querySelector('main') ??
				document.querySelector('article') ??
				document.body;

			const blocks = root.querySelectorAll<HTMLElement>(
				'section, div, article',
			);
			let largeEmptyBlocks = 0;

			for (const el of blocks) {
				const rect = el.getBoundingClientRect();
				const area = rect.width * rect.height;
				const textLength = (el.innerText || '').trim().length;

				if (area > 90_000 && textLength < 60) {
					largeEmptyBlocks += 1;
				}
			}

			return largeEmptyBlocks >= 1;
		});
	} catch {
		return false;
	}
}

/**
 * Wait until the page has a minimum amount of visible textual content.
 */
async function waitForVisibleContent(page: Page): Promise<void> {
	try {
		await page.waitForFunction(
			() => {
				const root =
					document.querySelector('main') ??
					document.querySelector('article') ??
					document.body;
				const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
				let visibleBlocks = 0;

				while (walker.nextNode()) {
					const el = walker.currentNode as HTMLElement;
					const textLength = (el.innerText || '').trim().length;
					if (textLength < 40) continue;

					const rect = el.getBoundingClientRect();
					if (rect.width < 120 || rect.height < 24) continue;

					const style = window.getComputedStyle(el);
					const hidden =
						style.display === 'none' ||
						style.visibility === 'hidden' ||
						Number(style.opacity || '1') < 0.5;
					if (hidden) continue;

					visibleBlocks += 1;
					if (visibleBlocks >= 2) return true;
				}

				return false;
			},
			{ timeout: VISIBLE_CONTENT_TIMEOUT_MS },
		);
	} catch {
		// Non-fatal
	}
}

/**
 * Strip native lazy attributes and scroll the page so IntersectionObserver-based
 * lazy loaders fire, then return to top.
 *
 * Critically: we snapshot scrollHeight BEFORE the loop and stop there.
 * Without this cap, infinite-scroll sites (WordPress, Wix) grow the page as
 * you scroll, so currentY never catches up and the loop runs forever.
 */
async function triggerLazyLoad(page: Page): Promise<void> {
	try {
		await page.evaluate(() => {
			document
				.querySelectorAll<
					HTMLImageElement | HTMLIFrameElement
				>('img[loading="lazy"], iframe[loading="lazy"]')
				.forEach((el) => el.removeAttribute('loading'));
		});

		// Snapshot the height NOW — we never scroll past this point.
		const initialScrollHeight = await page
			.evaluate(() =>
				Math.max(
					document.body.scrollHeight,
					document.documentElement.scrollHeight,
				),
			)
			.catch(() => 0);

		await page.evaluate(
			async ({ maxY }: { maxY: number }) => {
				await new Promise<void>((resolve) => {
					const scrollStep = Math.ceil(window.innerHeight * 0.8);
					const scrollDelay = 60;
					// Hard cap: never exceed 10 steps (avoids runaway on huge pages)
					const maxSteps = 10;
					let currentY = 0;
					let steps = 0;

					const step = () => {
						window.scrollBy(0, scrollStep);
						currentY += scrollStep;
						steps += 1;

						// Stop at initial height OR after 10 steps — whichever comes first
						if (currentY < maxY && steps < maxSteps) {
							setTimeout(step, scrollDelay);
						} else {
							window.scrollTo(0, 0);
							resolve();
						}
					};

					step();
				});
			},
			{ maxY: initialScrollHeight || 10_000 },
		);

		await page.waitForTimeout(AFTER_SCROLL_DELAY_MS);
	} catch {
		// Non-fatal
	}
}

/**
 * Wait until 90 % of page images are decoded.
 */
async function waitForMediaReady(page: Page): Promise<void> {
	try {
		await page.evaluate(
			async ({ timeoutMs }: { timeoutMs: number }) => {
				const wait = (ms: number) =>
					new Promise<void>((resolve) => setTimeout(resolve, ms));

				const isImageReady = (img: HTMLImageElement) =>
					img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;

				const decodeWithTimeout = async (
					img: HTMLImageElement,
				): Promise<void> => {
					if (typeof img.decode !== 'function') return;
					try {
						await Promise.race([img.decode(), wait(500)]);
					} catch {
						// non-fatal
					}
				};

				const start = Date.now();
				while (Date.now() - start < timeoutMs) {
					const images = Array.from(document.images);
					if (images.length === 0) return;

					for (const img of images) {
						if (!isImageReady(img)) {
							await decodeWithTimeout(img);
						}
					}

					const readyCount = images.filter(isImageReady).length;
					if (readyCount / images.length >= 0.9) return;

					await wait(120);
				}
			},
			{ timeoutMs: MEDIA_READY_TIMEOUT_MS },
		);
	} catch {
		// Non-fatal
	}
}

/**
 * Full pre-screenshot preparation pipeline.
 *
 * Timing budget (worst-case with the new lower caps):
 *   networkIdle 4s + animations 200ms + fonts 3s + lazyLoad ~1.5s + mediaReady 3s
 *   + 150ms + visibleContent 2s + layoutStable 1s ≈ ~15s max per call (was ~29s).
 */
function useFastScreenshotPrepare(): boolean {
	const raw = process.env.SCAN_SCREENSHOT_FAST?.trim().toLowerCase();
	return raw === '1' || raw === 'true';
}

export async function preparePageForScreenshot(
	page: Page,
	options?: { disableAnimations?: boolean; fast?: boolean },
): Promise<void> {
	const shouldDisableAnimations = options?.disableAnimations ?? true;
	const fast = options?.fast ?? useFastScreenshotPrepare();

	if (fast) {
		try {
			await page.waitForLoadState('domcontentloaded', { timeout: 3_000 });
		} catch {
			// non-fatal
		}
		try {
			await page.waitForLoadState('networkidle', {
				timeout: NETWORK_IDLE_FAST_MS,
			});
		} catch {
			// non-fatal
		}
		if (shouldDisableAnimations) {
			await disableAnimations(page);
		}
		await page.waitForTimeout(AFTER_MEDIA_READY_DELAY_MS);
		return;
	}

	await waitForNetworkIdle(page);
	if (shouldDisableAnimations) {
		await disableAnimations(page);
	}
	await waitForFontsReady(page);
	await triggerLazyLoad(page);
	await waitForMediaReady(page);
	await page.waitForTimeout(AFTER_MEDIA_READY_DELAY_MS);
	await forceRevealLikelyHiddenContent(page);
	await waitForVisibleContent(page);
	await waitForLayoutStable(page);
}

// ─── Screenshot capture ────────────────────────────────────────────────────

// How long to wait for a full-page screenshot before giving up and falling
// back to a viewport-only capture. Full-page requires Playwright to scroll
// the entire page (triggering lazy loading) which can hang indefinitely on
// WordPress / Shopify / Wix sites without this cap.
const SCREENSHOT_TIMEOUT_MS = 20_000;
const VIEWPORT_SCREENSHOT_TIMEOUT_MS = 10_000;

function useViewportFirstScreenshot(): boolean {
	const raw = process.env.SCAN_SCREENSHOT_VIEWPORT_FIRST?.trim().toLowerCase();
	return raw !== '0' && raw !== 'false';
}

/**
 * Take a PNG screenshot with a hard timeout.
 *
 * Default (SCAN_SCREENSHOT_VIEWPORT_FIRST): viewport-only first for speed on
 * remote Browserbase CDP. Set SCAN_SCREENSHOT_VIEWPORT_FIRST=0 for full-page first.
 */
export async function takeScreenshot(page: Page): Promise<Buffer> {
	let buffer: Buffer | null = null;

	if (useViewportFirstScreenshot()) {
		try {
			buffer = await page.screenshot({
				fullPage: false,
				type: 'png',
				timeout: VIEWPORT_SCREENSHOT_TIMEOUT_MS,
			});
		} catch {
			// fall through to full-page attempt
		}
	}

	if (!buffer || buffer.length === 0) {
		try {
			buffer = await page.screenshot({
				fullPage: true,
				type: 'png',
				timeout: SCREENSHOT_TIMEOUT_MS,
			});
		} catch {
			// Full-page timed out or threw — fall through to viewport fallback
		}
	}

	if (!buffer || buffer.length === 0) {
		buffer = await page.screenshot({
			fullPage: false,
			type: 'png',
			timeout: VIEWPORT_SCREENSHOT_TIMEOUT_MS,
		});
	}

	if (!buffer || buffer.length === 0) {
		throw new Error('screenshot_empty: Playwright returned an empty buffer');
	}

	return buffer;
}

/**
 * Capture a mobile page as overlapping vertical slices.
 *
 * WHY: Claude's vision API downscales images whose longest edge exceeds 1568px.
 * Each slice is ≤ MOBILE_SLICE_HEIGHT (844px) so Claude sees pixel-perfect UI.
 */
export async function takeMobileSlices(page: Page): Promise<{
	slices: Buffer[];
	totalHeight: number;
	sliceCount: number;
}> {
	const getCurrentPageHeight = () =>
		page.evaluate(() =>
			Math.max(
				document.body.scrollHeight,
				document.documentElement.scrollHeight,
			),
		);

	const totalHeight = await getCurrentPageHeight();

	const viewport = page.viewportSize();
	const viewportWidth = viewport?.width ?? 390;
	const viewportHeight = viewport?.height ?? MOBILE_SLICE_HEIGHT;
	const step = MOBILE_SLICE_HEIGHT - SLICE_OVERLAP_PX; // 664px
	const plannedSliceCount = Math.min(
		MAX_MOBILE_SLICES,
		Math.ceil(totalHeight / step),
	);

	const slices: Buffer[] = [];
	const usedPositions = new Set<number>();
	const positions: number[] = [];

	for (let i = 0; i < plannedSliceCount; i++) {
		positions.push(i * step);
	}

	const initialTailStart = Math.max(0, totalHeight - viewportHeight);
	positions.push(initialTailStart);

	for (let i = 0; i < positions.length; i++) {
		const currentHeight = await getCurrentPageHeight();
		const y = positions[i] ?? 0;

		if (y >= currentHeight) break;

		const maxStartY = Math.max(0, currentHeight - viewportHeight);
		const boundedY = Math.min(y, maxStartY);

		if (usedPositions.has(boundedY)) continue;
		usedPositions.add(boundedY);

		const clipHeight = Math.min(viewportHeight, currentHeight - boundedY);
		if (clipHeight <= 0) continue;

		await page.evaluate(
			(scrollY: number) => window.scrollTo(0, scrollY),
			boundedY,
		);
		await page.waitForTimeout(SLICE_SCROLL_SETTLE_MS);

		const buffer = await page.screenshot({
			clip: { x: 0, y: 0, width: viewportWidth, height: clipHeight },
			type: 'png',
			timeout: 10_000,
		});

		if (!buffer || buffer.length === 0) {
			throw new Error(
				`screenshot_empty: mobile slice ${i + 1}/${positions.length} returned empty buffer`,
			);
		}

		slices.push(buffer);
	}

	await page.evaluate(() => window.scrollTo(0, 0));

	return { slices, totalHeight, sliceCount: slices.length };
}

// --- Public API -----------------------------------------------------------

/**
 * Capture a desktop screenshot on the already-navigated `page`.
 */
export async function captureDesktopScreenshot(page: Page): Promise<Buffer> {
	await page.setViewportSize(DESKTOP_VIEWPORT);
	await preparePageForScreenshot(page, {
		disableAnimations: true,
		fast: useFastScreenshotPrepare(),
	});
	return takeScreenshot(page);
}
/**
 * Capture a mobile screenshot by spawning a fresh context with iPhone 14
 * device emulation.
 *
 * Returns `null` (never throws) so callers treat a missing mobile screenshot
 * as a non-fatal warning rather than a hard error.
 */
export async function captureMobileScreenshot(
	browser: Browser,
	url: string,
	warnings: string[],
): Promise<Buffer | null> {
	const iPhone = devices['iPhone 14'];
	let context: BrowserContext | undefined;

	try {
		context = await browser.newContext({ ...iPhone });

		const page = await context.newPage();
		const { navigation } = await safeGoto(page, url);

		if (navigation.warning) {
			warnings.push(`mobile_nav: ${navigation.warning}`);
		}

		await preparePageForScreenshot(page, { disableAnimations: false });

		if (await hasLikelyBlankMainContent(page)) {
			await page.evaluate(() =>
				window.scrollTo(0, Math.floor(window.innerHeight * 0.6)),
			);
			await page.waitForTimeout(150);
			await page.evaluate(() => window.scrollTo(0, 0));
			await preparePageForScreenshot(page, { disableAnimations: false });
			warnings.push(
				'mobile_blank_detected: applied recovery pass before screenshot',
			);
		}

		return await takeScreenshot(page);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		warnings.push(`mobile_screenshot_failed: ${message}`);
		return null;
	} finally {
		if (context) {
			await closeContext(context);
		}
	}
}
