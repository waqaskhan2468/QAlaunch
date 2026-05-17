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
// 1568px (or 2576px on Opus 4.7). A typical mobile full-page screenshot
// is 3000–5000px tall, which renders as an unreadable blob after downscale.
//
// Fix: capture 3–4 overlapping slices of ≤ 844px each. Every slice stays
// well under the 1568px limit so Claude sees pixel-perfect UI.
//
const MOBILE_SLICE_HEIGHT = 844; // matches iPhone 14 viewport height
const SLICE_OVERLAP_PX = 180; // larger overlap so seam content is never clipped
const MAX_MOBILE_SLICES = 4; // 4 × 744px step = ~3000px coverage

// ─── Timing ────────────────────────────────────────────────────────────────

const AFTER_SCROLL_DELAY_MS = 600; // let lazy-loaded images settle after scroll
const AFTER_ANIMATE_DELAY_MS = 300; // let CSS transitions finish after disabling
const AFTER_MEDIA_READY_DELAY_MS = 350; // final paint settle after media decode
const NETWORK_IDLE_TIMEOUT_MS = 8_000;
const FONTS_TIMEOUT_MS = 5_000;
const LAYOUT_SETTLE_TIMEOUT_MS = 2_000;
const VISIBLE_CONTENT_TIMEOUT_MS = 4_000;
const SLICE_SCROLL_SETTLE_MS = 80; // brief pause after scrolling to each slice position
const MEDIA_READY_TIMEOUT_MS = 6_000;

// ─── CSS injected into every page before screenshot ────────────────────────
//
// Goals:
//   1. Kill ALL animations / transitions so the screenshot is a stable frame
//   2. Force lazy images / iframes to load (removes loading="lazy")
//   3. Remove fixed/sticky elements that stack on top of content when
//      full-page screenshots are stitched together
//
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
			(timeout) =>
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
		// Brief pause so the browser applies the styles before we screenshot
		await page.waitForTimeout(AFTER_ANIMATE_DELAY_MS);
	} catch {
		// Non-fatal: worst case we get an animated frame
	}
}

/**
 * Wait until document height stabilizes across a few checks.
 * Helps avoid capturing intermediate states on smaller/mobile viewports.
 */
async function waitForLayoutStable(page: Page): Promise<void> {
	try {
		await page.evaluate(
			async ({ maxWaitMs }) => {
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

					await new Promise((resolve) => setTimeout(resolve, 120));
				}
			},
			{ maxWaitMs: LAYOUT_SETTLE_TIMEOUT_MS },
		);
	} catch {
		// Non-fatal
	}
}

/**
 * Some mobile UIs keep sections hidden until animation/reveal hooks run.
 * This gently forces common hidden states visible before capture.
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
 * This avoids capturing pre-hydration states on JS-heavy mobile layouts.
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
 * Force all `loading="lazy"` images and iframes to load by removing the
 * attribute, then scroll the full page height to trigger IntersectionObserver-
 * based lazy loaders (e.g. React-Lazyload, lozad, native lazy).
 *
 * After scrolling back to top we wait briefly so the browser can flush
 * any pending image decodes before the screenshot is taken.
 */
async function triggerLazyLoad(page: Page): Promise<void> {
	try {
		// 1. Strip native lazy attributes
		await page.evaluate(() => {
			document
				.querySelectorAll<
					HTMLImageElement | HTMLIFrameElement
				>('img[loading="lazy"], iframe[loading="lazy"]')
				.forEach((el) => el.removeAttribute('loading'));
		});

		// 2. Scroll incrementally to the bottom, triggering IntersectionObservers.
		// Then scroll back to top so first screenshot starts from stable top state.
		await page.evaluate(async () => {
			await new Promise<void>((resolve) => {
				const scrollStep = Math.ceil(window.innerHeight * 0.8);
				const scrollDelay = 80; // ms between steps — fast but visible to observers
				let currentY = 0;

				const step = () => {
					window.scrollBy(0, scrollStep);
					currentY += scrollStep;

					if (currentY < document.body.scrollHeight) {
						setTimeout(step, scrollDelay);
					} else {
						window.scrollTo(0, 0); // return to top for the screenshot
						resolve();
					}
				};

				step();
			});
		});

		// 3. Give the browser time to decode and paint newly-loaded images
		await page.waitForTimeout(AFTER_SCROLL_DELAY_MS);
	} catch {
		// Non-fatal
	}
}

/**
 * Wait until most page images are fully loaded/decoded.
 * This prevents "skeleton/blank card" captures on heavy landing pages.
 */
async function waitForMediaReady(page: Page): Promise<void> {
	try {
		await page.evaluate(
			async ({ timeoutMs }) => {
				const wait = (ms: number) =>
					new Promise<void>((resolve) => setTimeout(resolve, ms));

				const isImageReady = (img: HTMLImageElement) =>
					img.complete &&
					img.naturalWidth > 0 &&
					img.naturalHeight > 0;

				const decodeWithTimeout = async (
					img: HTMLImageElement,
				): Promise<void> => {
					if (typeof img.decode !== 'function') return;
					try {
						await Promise.race([img.decode(), wait(700)]);
					} catch {
						// non-fatal decode error
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
					// Accept 90% readiness to avoid hanging on tracking pixels/broken assets.
					if (readyCount / images.length >= 0.9) {
						return;
					}

					await wait(160);
				}
			},
			{ timeoutMs: MEDIA_READY_TIMEOUT_MS },
		);
	} catch {
		// Non-fatal
	}
}

/**
 * Full pre-screenshot preparation pipeline:
 *
 *   navigate → networkIdle → disableAnimations → fonts ready → triggerLazyLoad
 *     → forceReveal → waitForVisibleContent → waitForLayoutStable
 *
 * Running this before `page.screenshot()` maximises the chance that the
 * captured image shows a fully-rendered, stable UI — important for accurate
 * AI visual bug analysis with Claude.
 */
export async function preparePageForScreenshot(
	page: Page,
	options?: { disableAnimations?: boolean },
): Promise<void> {
	const shouldDisableAnimations = options?.disableAnimations ?? true;

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

/**
 * Take a full-page PNG screenshot.
 * Throws if Playwright returns an empty buffer (guards against silent null
 * being stored to the DB).
 */
export async function takeScreenshot(page: Page): Promise<Buffer> {
	const buffer = await page.screenshot({
		fullPage: true,
		type: 'png',
	});

	if (!buffer || buffer.length === 0) {
		throw new Error('screenshot_empty: Playwright returned an empty buffer');
	}

	return buffer;
}

/**
 * Capture a mobile page as overlapping vertical slices instead of one giant
 * full-page image.
 *
 * WHY: Claude's vision API downscales images whose longest edge exceeds
 * 1568px. A 3000px-tall mobile screenshot becomes an unreadable blob.
 * Each slice is ≤ MOBILE_SLICE_HEIGHT (844px) so Claude sees pixel-perfect UI.
 *
 * HOW:
 *  - Step size = MOBILE_SLICE_HEIGHT − SLICE_OVERLAP_PX (664px)
 *  - 180px overlap ensures seam content is never split between slices
 *  - MAX_MOBILE_SLICES caps at 4 (covers ~3000px pages)
 *  - Scrolls to each slice position so position:fixed elements reposition
 *
 * @throws if any individual slice buffer is empty
 */
export async function takeMobileSlices(page: Page): Promise<{
	slices: Buffer[];
	totalHeight: number;
	sliceCount: number;
}> {
	const getCurrentPageHeight = () =>
		page.evaluate(() =>
			Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
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

	// Always include tail anchor so final section is covered even when page height
	// changes during hydration/lazy-load.
	const initialTailStart = Math.max(0, totalHeight - viewportHeight);
	positions.push(initialTailStart);

	for (let i = 0; i < positions.length; i++) {
		const currentHeight = await getCurrentPageHeight();
		const y = positions[i] ?? 0;

		// Layout can shrink after lazy loads or hydration. Guard against stale Y.
		if (y >= currentHeight) {
			break;
		}

		// Anchor to the last viewport-sized window of the current document.
		const maxStartY = Math.max(0, currentHeight - viewportHeight);
		const boundedY = Math.min(y, maxStartY);

		if (usedPositions.has(boundedY)) {
			continue;
		}
		usedPositions.add(boundedY);

		const clipHeight = Math.min(viewportHeight, currentHeight - boundedY);
		if (clipHeight <= 0) {
			continue;
		}

		// Scroll first so fixed/sticky elements are in the same state users see.
		await page.evaluate((scrollY) => window.scrollTo(0, scrollY), boundedY);
		await page.waitForTimeout(SLICE_SCROLL_SETTLE_MS);

		// Capture current viewport window (top-origin clip) to avoid seam drift
		// between adjacent chunks when document height changes.
		const buffer = await page.screenshot({
			clip: { x: 0, y: 0, width: viewportWidth, height: clipHeight },
			type: 'png',
		});

		if (!buffer || buffer.length === 0) {
			throw new Error(
				`screenshot_empty: mobile slice ${i + 1}/${positions.length} returned empty buffer`,
			);
		}

		slices.push(buffer);
	}

	// Restore scroll to top
	await page.evaluate(() => window.scrollTo(0, 0));

	return { slices, totalHeight, sliceCount: slices.length };
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Capture a desktop screenshot on the already-navigated `page`.
 *
 * The caller is responsible for navigation; this function handles everything
 * from viewport sizing through the full preparation pipeline.
 *
 * @throws if the screenshot buffer is empty
 */
export async function captureDesktopScreenshot(page: Page): Promise<Buffer> {
	await page.setViewportSize(DESKTOP_VIEWPORT);
	await preparePageForScreenshot(page, { disableAnimations: true });
	return takeScreenshot(page);
}

/**
 * Capture a mobile screenshot by spawning a fresh context with iPhone 14
 * device emulation.
 *
 * A new context is used (not the caller's) so that device UA/viewport/touch
 * settings don't pollute the desktop session.
 *
 * Returns `null` (never throws) so callers can treat a missing mobile
 * screenshot as a non-fatal warning rather than a hard error.
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
			// One recovery pass: nudge viewport observers, then re-settle.
			await page.evaluate(() =>
				window.scrollTo(0, Math.floor(window.innerHeight * 0.6)),
			);
			await page.waitForTimeout(180);
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
