import type { Page } from 'playwright-core';

// Timing values tuned for Browserbase remote CDP.
const AFTER_SCROLL_DELAY_MS = 300;
const AFTER_ANIMATE_DELAY_MS = 200;
const LAYOUT_SETTLE_TIMEOUT_MS = 1_000;

const DISABLE_ANIMATIONS_CSS = `
  *, *::before, *::after {
    animation-duration:        0s !important;
    animation-delay:           0s !important;
    transition-duration:       0s !important;
    transition-delay:          0s !important;
    scroll-behavior:           auto !important;
  }
`;

// ─── Pre-screenshot helpers ────────────────────────────────────────────────

async function disableAnimations(page: Page): Promise<void> {
	try {
		await page.addStyleTag({ content: DISABLE_ANIMATIONS_CSS });
		await page.waitForTimeout(AFTER_ANIMATE_DELAY_MS);
	} catch {
		// Non-fatal
	}
}

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
 * Strip native lazy attributes and scroll the page so IntersectionObserver-based
 * lazy loaders fire, then return to top.
 *
 * Snapshot scrollHeight BEFORE the loop so infinite-scroll sites (WordPress, Wix)
 * can't grow the page under us and stall the loop.
 */
async function triggerLazyLoad(page: Page): Promise<void> {
	try {
		await page.evaluate(() => {
			document
				.querySelectorAll<HTMLImageElement | HTMLIFrameElement>(
					'img[loading="lazy"], iframe[loading="lazy"]',
				)
				.forEach((el) => el.removeAttribute('loading'));
		});

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
					const maxSteps = 10;
					let currentY = 0;
					let steps = 0;

					const step = () => {
						window.scrollBy(0, scrollStep);
						currentY += scrollStep;
						steps += 1;

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

// ─── Public: screenshot preparation ───────────────────────────────────────

// Read once at module load — these env vars never change at runtime.
const FAST_SCREENSHOT = (() => {
	const raw = process.env.SCAN_SCREENSHOT_FAST?.trim().toLowerCase();
	return raw === '1' || raw === 'true';
})();

const VIEWPORT_FIRST_SCREENSHOT = (() => {
	const raw = process.env.SCAN_SCREENSHOT_VIEWPORT_FIRST?.trim().toLowerCase();
	return raw !== '0' && raw !== 'false';
})();

/**
 * Pre-screenshot preparation pipeline.
 *
 * Default ("smart") mode — ~3 s max:
 *   disableAnimations (200 ms) + triggerLazyLoad (~1.5 s) +
 *   forceRevealLikelyHiddenContent (~100 ms) + waitForLayoutStable (≤1 s)
 *
 * Designed to run AFTER data collectors complete (Phase 2 in scanSingleUrl)
 * so the page main thread is idle and CDP round-trips are uncontested.
 * At that point the page is already settled — networkIdle, fonts, mediaReady,
 * and visibleContent checks are redundant and have been removed.
 *
 * Fast mode (SCAN_SCREENSHOT_FAST=true) — ~200 ms:
 *   animations disabled only; skips lazy-load triggering.
 */
export async function preparePageForScreenshot(
	page: Page,
	options?: { disableAnimations?: boolean; fast?: boolean },
): Promise<void> {
	const shouldDisableAnimations = options?.disableAnimations ?? true;
	const fast = options?.fast ?? FAST_SCREENSHOT;

	if (shouldDisableAnimations) await disableAnimations(page);
	if (fast) return;

	await triggerLazyLoad(page);
	await forceRevealLikelyHiddenContent(page);
	await waitForLayoutStable(page);
}

// ─── Public: screenshot capture ───────────────────────────────────────────

const SCREENSHOT_TIMEOUT_MS = 12_000;
const VIEWPORT_SCREENSHOT_TIMEOUT_MS = 7_000;

/**
 * Take a PNG screenshot with a hard timeout.
 * Defaults to viewport-only first for speed on remote Browserbase CDP.
 * Set SCAN_SCREENSHOT_VIEWPORT_FIRST=0 to try full-page first.
 */
export async function takeScreenshot(page: Page): Promise<Buffer> {
	let buffer: Buffer | null = null;

	if (VIEWPORT_FIRST_SCREENSHOT) {
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
		buffer = await page.screenshot({
			fullPage: true,
			type: 'png',
			timeout: SCREENSHOT_TIMEOUT_MS,
		});
	}

	if (!buffer || buffer.length === 0) {
		throw new Error('screenshot_empty: Playwright returned an empty buffer');
	}

	return buffer;
}

/**
 * Capture a desktop screenshot on the already-navigated `page`.
 *
 * @param options.fast – when true, skips lazy-load / content-reveal and just
 *   disables animations (~200ms). Pass `true` for early captures taken right
 *   after navigation; omit to use the SCAN_SCREENSHOT_FAST env default.
 */
export async function captureDesktopScreenshot(
	page: Page,
	options?: { fast?: boolean },
): Promise<Buffer> {
	const fast = options?.fast ?? FAST_SCREENSHOT;
	await preparePageForScreenshot(page, { disableAnimations: true, fast });
	return takeScreenshot(page);
}
