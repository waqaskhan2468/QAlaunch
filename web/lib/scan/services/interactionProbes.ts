import type { Page } from 'playwright-core';
import type { LinksResult } from '../types/scan.types';
import { logScanTiming } from './scan-timing';

/**
 * Active interaction probes — the "real interaction testing" layer that scrolls,
 * clicks, and navigates the page, on top of the static/visual collectors.
 *
 * These run on a dedicated Phase 3 AFTER the parallel Phase 1 collectors and both
 * screenshots have finished, because — unlike the collectors — they mutate page
 * state (scroll/click/navigate). Running them in parallel would destroy the
 * shared execution context the collectors rely on.
 *
 * Only the checks NOT already covered elsewhere live here:
 *   - Sticky nav on scroll (site-wide)            — new
 *   - Footer link scroll position (site-wide)     — new
 *   - External links missing target="_blank"      — derived from collectLinks data
 *   - Primary CTA click transition state          — new
 * Empty-form-submit and broken-link checks already run per-page (interactionTests
 * / links collectors), so they are intentionally NOT duplicated here.
 *
 * Evidence is structured text describing what was observed — judgment is left to
 * the AI. No screenshots are captured here, so this layer is independent of the
 * tier-based full-page/viewport screenshot mode.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type ProbeStatus = 'pass' | 'fail' | 'warn' | 'skip' | 'error';

export type InteractionProbeResult = {
	id: string;
	name: string;
	scope: 'site-wide' | 'per-page';
	status: ProbeStatus;
	/** What was observed — for the AI to judge. */
	observation: string;
	durationMs: number;
};

export type InteractionProbesPayload = {
	pageUrl: string;
	/** True when site-wide checks (sticky nav, footer scroll) ran on this page. */
	siteWide: boolean;
	results: InteractionProbeResult[];
	durationMs: number;
};

// Node-level hard ceiling per check so a hung page can't blow the page budget.
const PROBE_TIMEOUT_MS = 5_000;
// Playwright action timeout, kept below the Node ceiling so actions self-abort first.
const ACTION_TIMEOUT_MS = 3_000;
// Navigation-completion wait for the footer-link probe: a real client-side route
// change can take several seconds, so we wait for it explicitly (not a fixed
// delay) with a generous ceiling. The footer probe gets its own larger Node
// ceiling (FOOTER_PROBE_TIMEOUT_MS) to accommodate this.
const NAV_WAIT_TIMEOUT_MS = 9_000;
const FOOTER_PROBE_TIMEOUT_MS = 14_000;

const CTA_TEXT_PATTERN =
	'\\b(submit|get started|buy|add to cart|continue|sign up|start free|checkout|order now)\\b';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeResult(
	id: string,
	name: string,
	scope: InteractionProbeResult['scope'],
	status: ProbeStatus,
	observation: string,
	startedAt: number,
): InteractionProbeResult {
	return { id, name, scope, status, observation, durationMs: Date.now() - startedAt };
}

function errMsg(error: unknown): string {
	return error instanceof Error ? error.message : 'probe error';
}

/** Strip trailing slash + hash so two URLs for the same page compare equal. */
function sameUrl(a: string, b: string): boolean {
	const norm = (u: string) => {
		try {
			const url = new URL(u);
			url.hash = '';
			let s = url.toString();
			if (url.pathname !== '/' && s.endsWith('/')) s = s.slice(0, -1);
			return s;
		} catch {
			return u;
		}
	};
	return norm(a) === norm(b);
}

/** Node-level race backstop so a hung Playwright action can't exceed the ceiling. */
async function withProbeTimeout(
	fn: () => Promise<InteractionProbeResult>,
	timeoutMs: number = PROBE_TIMEOUT_MS,
): Promise<InteractionProbeResult> {
	const startedAt = Date.now();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<InteractionProbeResult>((resolve) => {
		timer = setTimeout(
			() =>
				resolve({
					id: 'probe-timeout',
					name: 'Interaction probe',
					scope: 'per-page',
					status: 'error',
					observation: `Probe exceeded ${timeoutMs}ms and was abandoned`,
					durationMs: Date.now() - startedAt,
				}),
			timeoutMs,
		);
	});
	try {
		return await Promise.race([fn(), timeout]);
	} catch (error) {
		return makeResult('probe-error', 'Interaction probe', 'per-page', 'error', errMsg(error), startedAt);
	} finally {
		if (timer) clearTimeout(timer);
	}
}

// ─── Check 1: Sticky nav on scroll (site-wide) ────────────────────────────────

async function stickyNavProbe(page: Page): Promise<InteractionProbeResult> {
	const id = 'sticky-nav';
	const name = 'Sticky navigation on scroll';
	const startedAt = Date.now();

	// Measure a specific candidate by index so the SAME element is re-measured
	// after scrolling. The old querySelector('header, nav, …') took the FIRST
	// match in the DOM — often an announcement bar or a hidden mobile drawer —
	// and produced false "nav disappeared" findings for perfectly sticky navs.
	const measureNavAt = (index: number) =>
		page.evaluate((i) => {
			const candidates = Array.from(
				document.querySelectorAll<HTMLElement>('header, nav, [role="banner"]'),
			);
			const nav = candidates[i];
			if (!nav) return null;
			const r = nav.getBoundingClientRect();
			const s = window.getComputedStyle(nav);
			const visible =
				r.height > 0 &&
				s.display !== 'none' &&
				s.visibility !== 'hidden' &&
				Number(s.opacity) > 0.05;
			return {
				top: Math.round(r.top),
				bottom: Math.round(r.bottom),
				position: s.position,
				visible,
				onScreen: visible && r.bottom > 0 && r.top < window.innerHeight,
				scrollY: Math.round(window.scrollY),
			};
		}, index);

	try {
		// Pick the page's real navigation bar: the first candidate that is
		// actually visible near the top of the viewport at scrollY=0.
		const navIndex = await page.evaluate(() => {
			const candidates = Array.from(
				document.querySelectorAll<HTMLElement>('header, nav, [role="banner"]'),
			);
			return candidates.findIndex((el) => {
				const r = el.getBoundingClientRect();
				const s = window.getComputedStyle(el);
				return (
					r.height > 8 &&
					r.width > 100 &&
					r.top < 200 &&
					s.display !== 'none' &&
					s.visibility !== 'hidden' &&
					Number(s.opacity) > 0.05
				);
			});
		});
		if (navIndex === -1) {
			return makeResult(id, name, 'site-wide', 'skip', 'No visible navigation bar found at the top of the page', startedAt);
		}

		await page.evaluate(() => window.scrollTo(0, 600));
		await page.waitForTimeout(500);

		const after = await measureNavAt(navIndex);

		if (after && after.scrollY < 100) {
			await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
			return makeResult(id, name, 'site-wide', 'skip', `Page did not scroll (height too short, y=${after.scrollY})`, startedAt);
		}

		if (after?.onScreen && after.top >= -4 && after.top < 80) {
			await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
			return makeResult(id, name, 'site-wide', 'pass', `Nav stayed fixed at the top after scrolling ${after.scrollY}px (position:${after.position}, top:${after.top}px).`, startedAt);
		}

		// Nav is hidden or off-screen after scrolling down. Very many sites use
		// the intentional hide-on-scroll-down / reveal-on-scroll-up pattern —
		// scroll up a little and re-measure before calling anything a problem.
		await page.evaluate(() => window.scrollBy(0, -250)).catch(() => {});
		await page.waitForTimeout(450);
		const rechecked = await measureNavAt(navIndex);

		// Restore scroll so later checks see a clean baseline.
		await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});

		if (rechecked?.onScreen && rechecked.top >= -4 && rechecked.top < 80) {
			return makeResult(
				id,
				name,
				'site-wide',
				'pass',
				`Nav hides while scrolling down and reappears on scroll-up (position:${rechecked.position}) — an intentional, common design pattern, not a defect.`,
				startedAt,
			);
		}

		if (!after || !rechecked) {
			return makeResult(id, name, 'site-wide', 'warn', 'Nav element could not be re-measured after scrolling (page re-rendered). Weak signal — do not report without visual confirmation.', startedAt);
		}

		// Static header that scrolls away with the page — extremely common and
		// NOT inherently a defect. Neutral wording so the AI does not dramatize.
		return makeResult(
			id,
			name,
			'site-wide',
			'warn',
			`Navigation is not sticky: it scrolls away with the page and did not reappear on a short scroll-up (position:${after.position}). This is a common, acceptable pattern — only worth reporting if the page is very long AND the screenshots confirm visitors have no way to navigate without scrolling all the way back up.`,
			startedAt,
		);
	} catch (error) {
		return makeResult(id, name, 'site-wide', 'error', errMsg(error), startedAt);
	}
}

// ─── Check 2: Footer link scroll position (site-wide) ──────────────────────────
//
// Detects the SPA anti-pattern where a client-side route change keeps the old
// scroll position instead of resetting to the top of the new page.

async function footerLinkScrollProbe(page: Page, pageUrl: string): Promise<InteractionProbeResult> {
	const id = 'footer-link-scroll';
	const name = 'Footer link scroll position';
	const startedAt = Date.now();

	try {
		const origin = new URL(pageUrl).origin;
		// Leave headroom under the probe's (larger) ceiling for one more nav wait.
		const deadline = startedAt + FOOTER_PROBE_TIMEOUT_MS - NAV_WAIT_TIMEOUT_MS - 1_000;
		const observations: string[] = [];
		let tested = 0;
		let flagged = 0;

		// Internal footer link count, to bound iteration.
		const footerHrefs = await page.evaluate(() => {
			const footer = document.querySelector('footer');
			if (!footer) return [];
			return Array.from(footer.querySelectorAll<HTMLAnchorElement>('a[href]'))
				.map((a) => a.getAttribute('href') ?? '')
				.filter(
					(h) =>
						h &&
						!h.startsWith('#') &&
						!h.startsWith('mailto:') &&
						!h.startsWith('tel:') &&
						!h.startsWith('javascript:'),
				);
		});

		if (footerHrefs.length === 0) {
			return makeResult(id, name, 'site-wide', 'skip', 'No footer links found', startedAt);
		}

		const internal = footerHrefs
			.map((h) => {
				try {
					const abs = new URL(h, pageUrl).toString();
					return new URL(abs).origin === origin ? abs : null;
				} catch {
					return null;
				}
			})
			.filter((h): h is string => h !== null)
			.slice(0, 2);

		if (internal.length === 0) {
			return makeResult(id, name, 'site-wide', 'skip', 'All footer links are external', startedAt);
		}

		for (const href of internal) {
			if (Date.now() > deadline) break;
			try {
				// Re-establish baseline at the original page, scrolled down.
				if (!sameUrl(page.url(), pageUrl)) {
					await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: ACTION_TIMEOUT_MS });
				}
				await page.evaluate(() =>
					window.scrollTo(0, Math.max(500, document.documentElement.scrollHeight)),
				);
				await page.waitForTimeout(120);

				// Click the matching footer anchor (real click → triggers SPA routing).
				const clicked = await page.evaluate((target) => {
					const footer = document.querySelector('footer');
					if (!footer) return false;
					const anchors = Array.from(footer.querySelectorAll<HTMLAnchorElement>('a[href]'));
					const match = anchors.find((a) => {
						try {
							return new URL(a.getAttribute('href') ?? '', window.location.href).toString() === target;
						} catch {
							return false;
						}
					});
					if (!match) return false;
					match.click();
					return true;
				}, href);

				if (!clicked) continue;

				// Wait for the transition to ACTUALLY complete before measuring, rather
				// than a fixed delay that races a fast or slow client-side router. We wait
				// for the URL to change (history push or full load), then for the network
				// to settle, then a short beat for scroll restoration to apply.
				const navigated = await page
					.waitForURL((u) => !sameUrl(u.toString(), pageUrl), {
						timeout: NAV_WAIT_TIMEOUT_MS,
					})
					.then(() => true)
					.catch(() => false);
				await page
					.waitForLoadState('networkidle', { timeout: 3_000 })
					.catch(() => {});
				await page.waitForTimeout(200); // let SPA scroll-restoration settle
				const afterY = await page.evaluate(() => Math.round(window.scrollY)).catch(() => null);
				const afterUrl = page.url();
				tested += 1;

				if (!navigated && sameUrl(afterUrl, pageUrl)) {
					observations.push(`${href}: did not navigate within ${NAV_WAIT_TIMEOUT_MS}ms (in-page anchor or blocked) — not flagged`);
					continue;
				}

				if (afterY === null) {
					observations.push(`${href}: full reload (loads at top)`);
					continue;
				}
				if (sameUrl(afterUrl, pageUrl)) {
					observations.push(`${href}: did not navigate (in-page anchor or blocked)`);
					continue;
				}
				if (afterY > 150) {
					flagged += 1;
					observations.push(`${afterUrl}: kept scroll position y=${afterY} instead of resetting to top`);
				} else {
					observations.push(`${afterUrl}: reset to top (y=${afterY})`);
				}
			} catch (error) {
				observations.push(`${href}: ${errMsg(error)}`);
			}
		}

		if (tested === 0) {
			return makeResult(id, name, 'site-wide', 'skip', `Could not exercise footer links: ${observations.join('; ') || 'none reachable'}`, startedAt);
		}

		const status: ProbeStatus = flagged > 0 ? 'fail' : 'pass';
		const summary =
			flagged > 0
				? `${flagged} of ${tested} footer link(s) loaded at the previous scroll position instead of the top. `
				: `${tested} footer link(s) reset to the top on navigation. `;
		return makeResult(id, name, 'site-wide', status, summary + observations.join('; '), startedAt);
	} catch (error) {
		return makeResult(id, name, 'site-wide', 'error', errMsg(error), startedAt);
	}
}

// ─── Check 4: External links missing target="_blank" (per-page, derived) ──────
//
// Reuses link data already collected by collectLinks (target/rel/isExternal) —
// no second DOM scan.

function externalLinkTargetProbe(links: LinksResult | undefined): InteractionProbeResult {
	const id = 'external-link-target';
	const name = 'External links open in a new tab';
	const startedAt = Date.now();

	try {
		if (!links?.links?.length) {
			return makeResult(id, name, 'per-page', 'skip', 'No links collected for this page', startedAt);
		}
		const external = links.links.filter((l) => l.isExternal);
		if (external.length === 0) {
			return makeResult(id, name, 'per-page', 'skip', 'No external links on this page', startedAt);
		}
		const missing = external.filter((l) => (l.target ?? '').toLowerCase() !== '_blank');
		if (missing.length === 0) {
			return makeResult(id, name, 'per-page', 'pass', `All ${external.length} external link(s) use target="_blank".`, startedAt);
		}
		const examples = missing.slice(0, 3).map((l) => `"${l.text || l.href}"`).join(', ');
		return makeResult(
			id,
			name,
			'per-page',
			'fail',
			`${missing.length} of ${external.length} external link(s) lack target="_blank" (open in the same tab): ${examples}.`,
			startedAt,
		);
	} catch (error) {
		return makeResult(id, name, 'per-page', 'error', errMsg(error), startedAt);
	}
}

// ─── Check 5: Primary CTA click transition state (per-page) ───────────────────
//
// Clicks a primary CTA and samples its DOM state every 100ms for 1s. Flags if
// the button content empties during the transition without a visible
// loading/disabled state.

async function buttonClickStateProbe(page: Page): Promise<InteractionProbeResult> {
	const id = 'button-click-state';
	const name = 'Primary CTA click transition state';
	const startedAt = Date.now();
	const MARKER = 'data-qal-cta-probe';

	try {
		const target = await page.evaluate(
			({ pattern, marker }) => {
				const re = new RegExp(pattern, 'i');
				const els = Array.from(
					document.querySelectorAll<HTMLElement>(
						'button, a[role="button"], a.button, [class*="btn"], input[type="submit"]',
					),
				);
				for (const el of els) {
					const text = (el.innerText || (el as HTMLInputElement).value || '').trim();
					if (!text || !re.test(text)) continue;
					const r = el.getBoundingClientRect();
					const s = window.getComputedStyle(el);
					const visible =
						r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
					if (!visible) continue;
					el.setAttribute(marker, '1');
					return { text: text.slice(0, 60), baselineLen: text.length };
				}
				return null;
			},
			{ pattern: CTA_TEXT_PATTERN, marker: MARKER },
		);

		if (!target) {
			return makeResult(id, name, 'per-page', 'skip', 'No primary CTA button found on this page', startedAt);
		}

		const sel = `[${MARKER}="1"]`;

		// Click without waiting for navigation, so we can sample the transition.
		await page
			.locator(sel)
			.click({ timeout: ACTION_TIMEOUT_MS, noWaitAfter: true })
			.catch(() => {});

		let navigated = false;
		let emptied = false;
		let hadFeedback = false;

		for (let t = 0; t < 1000; t += 100) {
			await page.waitForTimeout(100);
			const snap = await page
				.evaluate((selector) => {
					const el = document.querySelector(selector);
					if (!el) return { gone: true, len: 0, loading: false, disabled: false };
					const len = (el.textContent ?? '').trim().length;
					const disabled =
						(el as HTMLButtonElement).disabled === true ||
						el.getAttribute('aria-disabled') === 'true';
					const busy = el.getAttribute('aria-busy') === 'true';
					const loadingClass =
						/\b(loading|spinner|busy)\b/i.test(el.className || '') ||
						!!el.querySelector('[class*="spinner"], [class*="loading"], svg[class*="spin"]');
					return { gone: false, len, loading: busy || loadingClass, disabled };
				}, sel)
				.catch(() => null);

			if (!snap || snap.gone) {
				navigated = true;
				break;
			}
			if (snap.loading || snap.disabled) hadFeedback = true;
			if (target.baselineLen > 0 && snap.len === 0) emptied = true;
		}

		// Best-effort cleanup of the marker (page may have navigated away).
		await page.evaluate((sel2) => document.querySelector(sel2)?.removeAttribute(sel2), MARKER).catch(() => {});

		if (emptied && !hadFeedback) {
			return makeResult(
				id,
				name,
				'per-page',
				'fail',
				`CTA "${target.text}" emptied its content during the click transition with no visible loading/disabled state.`,
				startedAt,
			);
		}
		if (emptied && hadFeedback) {
			return makeResult(id, name, 'per-page', 'pass', `CTA "${target.text}" emptied but showed a loading/disabled state during the transition.`, startedAt);
		}
		if (navigated) {
			return makeResult(id, name, 'per-page', 'pass', `CTA "${target.text}" triggered a navigation/route change after click; no broken empty state observed beforehand.`, startedAt);
		}
		return makeResult(id, name, 'per-page', 'pass', `CTA "${target.text}" stayed stable after click (content preserved${hadFeedback ? ', loading/disabled state shown' : ''}).`, startedAt);
	} catch (error) {
		return makeResult(id, name, 'per-page', 'error', errMsg(error), startedAt);
	}
}

// ─── Runner ───────────────────────────────────────────────────────────────────

/**
 * Run the active interaction probes on an already-navigated page.
 *
 * - Per-page checks (external link target, CTA click state) run on every page.
 * - Site-wide checks (sticky nav, footer scroll) run only when `siteWide` is true
 *   (the homepage).
 *
 * Each check is independently guarded by a try/catch and a Node-level timeout, so
 * one failing/hanging check never crashes the page scan. Navigating checks run
 * last and re-establish their own baseline.
 */
export async function collectInteractionProbes(
	page: Page,
	pageUrl: string,
	options: {
		siteWide: boolean;
		links?: LinksResult;
		timing?: { scanId?: string; pageUrl?: string; tier?: string };
	},
): Promise<InteractionProbesPayload> {
	const startedAt = Date.now();
	const results: InteractionProbeResult[] = [];

	// Per-page, static — derived from already-collected link data.
	results.push(externalLinkTargetProbe(options.links));

	// Site-wide, scroll-only — runs on a clean page before any navigating check.
	if (options.siteWide) {
		results.push(await withProbeTimeout(() => stickyNavProbe(page)));
	}

	// Per-page, may navigate.
	results.push(await withProbeTimeout(() => buttonClickStateProbe(page)));

	// Site-wide, navigates — runs last and re-establishes its own baseline. Gets a
	// larger ceiling because it waits for real navigation completion (not a fixed delay).
	if (options.siteWide) {
		results.push(
			await withProbeTimeout(
				() => footerLinkScrollProbe(page, pageUrl),
				FOOTER_PROBE_TIMEOUT_MS,
			),
		);
	}

	const durationMs = Date.now() - startedAt;
	logScanTiming('interaction_probes', durationMs, {
		...options.timing,
		ok: true,
		siteWide: options.siteWide,
		probesRun: results.length,
		probesFailed: results.filter((r) => r.status === 'fail').length,
	});

	return { pageUrl, siteWide: options.siteWide, results, durationMs };
}
