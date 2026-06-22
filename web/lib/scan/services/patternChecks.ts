import type { Page } from 'playwright-core';
import type { IssueCategory, IssueSeverity } from '@/lib/scan/ai/types';
import type { LinksResult } from '../types/scan.types';
import { logScanTiming } from './scan-timing';

/**
 * Deterministic homepage pattern checks — the "verified pattern" layer.
 *
 * Unlike interactionTests / interactionProbes (which feed observations to the AI
 * for judgement), these are 100% programmatic: a failing check carries a fixed,
 * factual issue payload (category / severity / title / description / impact) that
 * is turned DIRECTLY into a verified_pattern issue at persist time — no AI in the
 * loop. They also get summarised into the AI prompt so the model does not
 * re-report the same thing.
 *
 * Runs in Phase 3 on the idle desktop page (after screenshots), alongside the
 * interaction probes, because the button hover/focus check mutates element state.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type PatternCheckStatus = 'pass' | 'fail' | 'skip' | 'error';

/**
 * One check result. When `status === 'fail'` the issue-payload fields
 * (category/severity/title/description/impact) are populated and become a
 * verified_pattern issue verbatim.
 */
export type PatternCheckResult = {
	id: string;
	name: string;
	status: PatternCheckStatus;
	category?: IssueCategory;
	severity?: IssueSeverity;
	title?: string;
	description?: string;
	impact?: string;
	pageSection?: string;
	/** Short machine-facing note (e.g. measured ratio); not shown to users. */
	detail?: string;
	durationMs: number;
};

export type PatternChecksPayload = {
	pageUrl: string;
	results: PatternCheckResult[];
	durationMs: number;
};

// Static DOM read for checks 1-5; one evaluate() call, no page mutation.
const STATIC_EVAL_TIMEOUT_MS = 6_000;
// Per-element-state probe ceiling for the hover/focus check.
const STATE_ACTION_TIMEOUT_MS = 1_500;
// Cap how many candidate buttons we hover/focus so a button-heavy page can't
// blow the page budget.
const MAX_BUTTONS_CHECKED = 6;

// ─── Static DOM measurements (checks 1-5) ─────────────────────────────────────

type StaticMeasurements = {
	logo: { found: boolean; linkedHome: boolean; hint: string } | null;
	contrast: {
		count: number;
		worstRatio: number | null;
		worstNormalRatio: number | null;
		failures: Array<{ hint: string; ratio: number; large: boolean; text: string }>;
	};
	nav: {
		currentFound: boolean;
		distinct: boolean;
		total: number;
		currentLabel: string;
	} | null;
	destinations: {
		mismatches: Array<{ kind: string; platform: string; href: string; label: string }>;
	};
	hero: { heroPx: number; viewportPx: number; ratio: number; hint: string } | null;
};

/**
 * All of checks 1-5 in a single in-page pass. Pure DOM/computed-style reads —
 * returns raw measurements; the human-facing issue text is built in Node.
 *
 * `arg.cutoff` is the y-pixel below which elements are out of scope for this
 * tier (free → bottom of hero + first sections; paid → effectively infinite).
 * Element-based checks ignore anything starting below the cutoff.
 */
function staticMeasureInPage(arg: { cutoff: number }): StaticMeasurements {
	const cutoff = arg?.cutoff ?? Number.POSITIVE_INFINITY;
	const round = (n: number) => Math.round(n * 100) / 100;
	const withinCutoff = (el: Element): boolean =>
		(el as HTMLElement).getBoundingClientRect().top <= cutoff;

	// — color helpers —
	function parseColor(input: string): [number, number, number, number] | null {
		const m = input.match(
			/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+))?/i,
		);
		if (!m) return null;
		return [
			Number(m[1]),
			Number(m[2]),
			Number(m[3]),
			m[4] === undefined ? 1 : Number(m[4]),
		];
	}
	function channelLum(c: number): number {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
	}
	function luminance(r: number, g: number, b: number): number {
		return 0.2126 * channelLum(r) + 0.7152 * channelLum(g) + 0.0722 * channelLum(b);
	}
	function contrastRatio(
		fg: [number, number, number],
		bg: [number, number, number],
	): number {
		const l1 = luminance(fg[0], fg[1], fg[2]);
		const l2 = luminance(bg[0], bg[1], bg[2]);
		const lighter = Math.max(l1, l2);
		const darker = Math.min(l1, l2);
		return (lighter + 0.05) / (darker + 0.05);
	}
	function composite(
		fg: [number, number, number, number],
		bg: [number, number, number],
	): [number, number, number] {
		const a = fg[3];
		return [
			Math.round(fg[0] * a + bg[0] * (1 - a)),
			Math.round(fg[1] * a + bg[1] * (1 - a)),
			Math.round(fg[2] * a + bg[2] * (1 - a)),
		];
	}
	/** Effective background by walking ancestors to the first opaque-enough layer. */
	function effectiveBg(el: Element): [number, number, number] {
		let node: Element | null = el;
		while (node) {
			const bg = parseColor(getComputedStyle(node).backgroundColor);
			if (bg && bg[3] >= 0.5) return [bg[0], bg[1], bg[2]];
			node = node.parentElement;
		}
		return [255, 255, 255]; // assume white page background
	}
	function isVisible(el: Element): boolean {
		const r = (el as HTMLElement).getBoundingClientRect();
		if (r.width < 2 || r.height < 2) return false;
		const s = getComputedStyle(el);
		return (
			s.visibility !== 'hidden' &&
			s.display !== 'none' &&
			Number(s.opacity || '1') > 0.05
		);
	}
	function hint(el: Element): string {
		const tag = el.tagName.toLowerCase();
		const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : '';
		const cls =
			typeof (el as HTMLElement).className === 'string' &&
			(el as HTMLElement).className.trim()
				? `.${(el as HTMLElement).className.trim().split(/\s+/).slice(0, 2).join('.')}`
				: '';
		return `${tag}${id}${cls}`.slice(0, 80);
	}
	function resolveHref(a: HTMLAnchorElement): URL | null {
		try {
			return new URL(a.href, location.href);
		} catch {
			return null;
		}
	}

	const origin = location.origin;
	const currentPath = location.pathname.replace(/\/+$/, '') || '/';

	// — Check 1: logo linked to home —
	let logo: StaticMeasurements['logo'] = null;
	{
		const header =
			document.querySelector('header, [role="banner"], nav') || document.body;
		const candidates = Array.from(
			header.querySelectorAll('img, svg, a'),
		) as HTMLElement[];
		let logoEl: HTMLElement | null = null;
		for (const el of candidates) {
			const hay =
				`${el.id} ${typeof el.className === 'string' ? el.className : ''} ` +
				`${el.getAttribute('alt') ?? ''} ${el.getAttribute('aria-label') ?? ''}`.toLowerCase();
			if (hay.includes('logo') || hay.includes('brand')) {
				logoEl = el;
				break;
			}
		}
		// Fallback: the first visible image inside the header.
		if (!logoEl) {
			logoEl =
				(Array.from(header.querySelectorAll('img')) as HTMLElement[]).find(
					isVisible,
				) ?? null;
		}
		if (logoEl) {
			const anchor =
				logoEl.tagName === 'A'
					? (logoEl as HTMLAnchorElement)
					: (logoEl.closest('a') as HTMLAnchorElement | null);
			let linkedHome = false;
			if (anchor) {
				const u = resolveHref(anchor);
				if (u && u.origin === origin) {
					const p = u.pathname.replace(/\/+$/, '') || '/';
					linkedHome = p === '/' || p === currentPath;
				}
			}
			logo = { found: true, linkedHome, hint: hint(logoEl) };
		}
	}

	// — Check 2: text contrast (WCAG AA) —
	const contrastFailures: StaticMeasurements['contrast']['failures'] = [];
	let worstRatio: number | null = null;
	let worstNormalRatio: number | null = null;
	let checkedCount = 0;
	{
		const all = Array.from(document.querySelectorAll('body *')) as HTMLElement[];
		for (const el of all) {
			if (checkedCount >= 600) break;
			// Only elements with their own visible text (not just child text).
			const direct = Array.from(el.childNodes).some(
				(n) => n.nodeType === 3 && (n.textContent ?? '').trim().length >= 3,
			);
			if (!direct || !isVisible(el) || !withinCutoff(el)) continue;
			const s = getComputedStyle(el);
			const fg = parseColor(s.color);
			if (!fg) continue;
			checkedCount += 1;
			const bg = effectiveBg(el);
			const ratio = round(contrastRatio(composite(fg, bg), bg));
			const fontPx = parseFloat(s.fontSize) || 16;
			const weight = parseInt(s.fontWeight, 10) || 400;
			const large = fontPx >= 24 || (fontPx >= 18.66 && weight >= 700);
			const threshold = large ? 3 : 4.5;
			worstRatio = worstRatio === null ? ratio : Math.min(worstRatio, ratio);
			if (!large)
				worstNormalRatio =
					worstNormalRatio === null ? ratio : Math.min(worstNormalRatio, ratio);
			if (ratio < threshold) {
				if (contrastFailures.length < 8) {
					contrastFailures.push({
						hint: hint(el),
						ratio,
						large,
						text: (el.textContent ?? '').trim().slice(0, 40),
					});
				}
			}
		}
	}

	// — Check 3: current nav item active state —
	let nav: StaticMeasurements['nav'] = null;
	{
		const navRoot =
			document.querySelector('nav, header [role="navigation"], header') || null;
		if (navRoot) {
			const links = (
				Array.from(navRoot.querySelectorAll('a[href]')) as HTMLAnchorElement[]
			).filter(isVisible);
			if (links.length >= 2) {
				const sig = (a: HTMLAnchorElement): string => {
					const s = getComputedStyle(a);
					return [
						s.color,
						s.fontWeight,
						s.textDecorationLine,
						s.borderBottomWidth + s.borderBottomColor,
						s.backgroundColor,
					].join('|');
				};
				let current: HTMLAnchorElement | null = null;
				for (const a of links) {
					const u = resolveHref(a);
					if (!u || u.origin !== origin) continue;
					const p = u.pathname.replace(/\/+$/, '') || '/';
					if (p === currentPath) {
						current = a;
						break;
					}
				}
				if (current) {
					const ariaCurrent = current.getAttribute('aria-current');
					const currentSig = sig(current);
					const others = links.filter((a) => a !== current);
					const sameAsAll =
						others.length > 0 && others.every((a) => sig(a) === currentSig);
					const distinct = Boolean(ariaCurrent) || !sameAsAll;
					nav = {
						currentFound: true,
						distinct,
						total: links.length,
						currentLabel: (current.textContent ?? '').trim().slice(0, 40),
					};
				} else {
					nav = { currentFound: false, distinct: false, total: links.length, currentLabel: '' };
				}
			}
		}
	}

	// — Check 4: link/icon destination mismatch (social + label-vs-host) —
	const destMismatches: StaticMeasurements['destinations']['mismatches'] = [];
	{
		const SOCIAL: Array<{ name: string; hosts: string[] }> = [
			{ name: 'Facebook', hosts: ['facebook.com', 'fb.com'] },
			{ name: 'Instagram', hosts: ['instagram.com'] },
			{ name: 'X (Twitter)', hosts: ['twitter.com', 'x.com'] },
			{ name: 'LinkedIn', hosts: ['linkedin.com'] },
			{ name: 'YouTube', hosts: ['youtube.com', 'youtu.be'] },
			{ name: 'TikTok', hosts: ['tiktok.com'] },
			{ name: 'GitHub', hosts: ['github.com'] },
			{ name: 'Pinterest', hosts: ['pinterest.com'] },
		];
		const anchors = (
			Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[]
		).filter((a) => isVisible(a) && withinCutoff(a));
		for (const a of anchors) {
			if (destMismatches.length >= 6) break;
			const label =
				`${a.getAttribute('aria-label') ?? ''} ${a.getAttribute('title') ?? ''} ` +
				`${a.className || ''} ${a.id || ''} ${a.textContent ?? ''} ` +
				`${a.querySelector('use')?.getAttribute('href') ?? ''} ` +
				`${a.querySelector('img')?.getAttribute('alt') ?? ''}`.toLowerCase();
			const platform = SOCIAL.find((p) =>
				new RegExp(`\\b${p.name.split(' ')[0].toLowerCase()}\\b`).test(label),
			);
			const u = resolveHref(a);
			const rawHref = a.getAttribute('href') ?? '';
			if (platform) {
				const placeholder =
					rawHref === '#' ||
					rawHref === '' ||
					rawHref.startsWith('javascript:');
				const host = u ? u.hostname.replace(/^www\./, '') : '';
				const matches = platform.hosts.some((h) => host.endsWith(h));
				if (placeholder || (u && !matches)) {
					destMismatches.push({
						kind: 'social',
						platform: platform.name,
						href: placeholder ? rawHref || '(empty)' : u ? u.href : rawHref,
						label: (a.getAttribute('aria-label') ?? a.textContent ?? platform.name)
							.trim()
							.slice(0, 40),
					});
				}
			}
		}
	}

	// — Check 5: hero taller than viewport —
	let hero: StaticMeasurements['hero'] = null;
	{
		const viewportPx = window.innerHeight || 900;
		let heroEl =
			(document.querySelector(
				'[class*="hero" i], [id*="hero" i], [class*="banner" i], [class*="jumbotron" i], [class*="masthead" i]',
			) as HTMLElement | null) ?? null;
		if (!heroEl) {
			const main = document.querySelector('main') || document.body;
			heroEl =
				(Array.from(main.querySelectorAll(':scope > section, :scope > div')) as HTMLElement[]).find(
					(el) => {
						const r = el.getBoundingClientRect();
						return r.top < viewportPx && r.height > 100 && isVisible(el);
					},
				) ?? null;
		}
		if (heroEl) {
			const heroPx = Math.round(heroEl.getBoundingClientRect().height);
			hero = {
				heroPx,
				viewportPx,
				ratio: round(heroPx / viewportPx),
				hint: hint(heroEl),
			};
		}
	}

	return {
		logo,
		contrast: {
			count: checkedCount,
			worstRatio,
			worstNormalRatio,
			failures: contrastFailures,
		},
		nav,
		destinations: { mismatches: destMismatches },
		hero,
	};
}

// ─── Node-side issue builders ─────────────────────────────────────────────────

const SECTION = 'Homepage';

function buildStaticResults(
	m: StaticMeasurements,
	timings: Record<string, number>,
): PatternCheckResult[] {
	const out: PatternCheckResult[] = [];

	// 1. Logo → home link
	if (!m.logo || !m.logo.found) {
		out.push(skip('logo-home-link', 'Logo links to homepage', timings.static));
	} else if (m.logo.linkedHome) {
		out.push(pass('logo-home-link', 'Logo links to homepage', timings.static));
	} else {
		out.push({
			id: 'logo-home-link',
			name: 'Logo links to homepage',
			status: 'fail',
			category: 'usability_ux',
			severity: 'medium',
			title: 'Site logo does not link back to the homepage',
			description:
				'The site logo in the header is not wrapped in a link that returns visitors to the homepage. ' +
				'Clicking the logo to get home is an almost universal expectation, so people who click it and ' +
				'nothing happens can feel briefly stuck and have to hunt for a Home menu item instead.',
			impact:
				'Visitors who click the logo to return home find that nothing happens, adding friction to navigation.',
			pageSection: SECTION,
			detail: m.logo.hint,
			durationMs: timings.static,
		});
	}

	// 2. Contrast
	if (m.contrast.count === 0) {
		out.push(skip('text-contrast', 'Text contrast meets WCAG AA', timings.static));
	} else if (m.contrast.failures.length === 0) {
		out.push(pass('text-contrast', 'Text contrast meets WCAG AA', timings.static));
	} else {
		const worstNormal = m.contrast.worstNormalRatio;
		const severe = worstNormal !== null && worstNormal < 3;
		const examples = m.contrast.failures
			.slice(0, 3)
			.map((f) => `"${f.text}" (${f.ratio}:1)`)
			.join(', ');
		out.push({
			id: 'text-contrast',
			name: 'Text contrast meets WCAG AA',
			status: 'fail',
			category: 'accessibility',
			severity: severe ? 'high' : 'medium',
			title: 'Some text is hard to read against its background',
			description:
				`${m.contrast.failures.length} text element(s) fall below the minimum contrast ratio for ` +
				`comfortable reading (4.5:1 for normal text, 3:1 for large text), measured from the actual ` +
				`rendered colours. Examples: ${examples}. Low-contrast text is hardest on mobile, in sunlight, ` +
				`and for anyone with reduced vision.`,
			impact:
				'Some visitors struggle to read low-contrast text, especially on phones or in bright light.',
			pageSection: SECTION,
			detail: `worstNormalRatio=${worstNormal ?? 'n/a'}`,
			durationMs: timings.static,
		});
	}

	// 3. Nav active state
	if (!m.nav) {
		out.push(skip('nav-active-state', 'Current nav item is highlighted', timings.static));
	} else if (!m.nav.currentFound) {
		out.push(skip('nav-active-state', 'Current nav item is highlighted', timings.static));
	} else if (m.nav.distinct) {
		out.push(pass('nav-active-state', 'Current nav item is highlighted', timings.static));
	} else {
		out.push({
			id: 'nav-active-state',
			name: 'Current nav item is highlighted',
			status: 'fail',
			category: 'usability_ux',
			severity: 'low',
			title: 'The current page is not highlighted in the navigation',
			description:
				'The navigation link for the page being viewed looks identical to every other link — there is ' +
				'no distinct colour, weight, underline, or marker showing where the visitor currently is. A ' +
				'visible "you are here" state helps people keep their bearings as they move around the site.',
			impact:
				'Visitors get a weaker sense of where they are on the site, which can make navigation feel less clear.',
			pageSection: SECTION,
			detail: `navLinks=${m.nav.total}`,
			durationMs: timings.static,
		});
	}

	// 4. Destination mismatch
	if (m.destinations.mismatches.length === 0) {
		out.push(pass('link-destination', 'Links point to their expected destination', timings.static));
	} else {
		const first = m.destinations.mismatches[0];
		const list = m.destinations.mismatches
			.slice(0, 3)
			.map((x) => `${x.platform} → ${x.href}`)
			.join(', ');
		out.push({
			id: 'link-destination',
			name: 'Links point to their expected destination',
			status: 'fail',
			category: 'functionality',
			severity: 'medium',
			title: 'A social link points to the wrong destination',
			description:
				`${m.destinations.mismatches.length} link(s) labelled for one destination point somewhere ` +
				`else (or nowhere). For example the ${first.platform} icon does not lead to a ${first.platform} ` +
				`page. Full list: ${list}. Visitors who click expecting one place and land somewhere unexpected ` +
				`lose trust and may not find the real profile.`,
			impact:
				'People clicking these links end up somewhere other than the destination the link advertises.',
			pageSection: SECTION,
			detail: list,
			durationMs: timings.static,
		});
	}

	// 5. Hero height
	if (!m.hero) {
		out.push(skip('hero-height', 'Hero fits within the viewport', timings.static));
	} else if (m.hero.ratio <= 1.5) {
		out.push(pass('hero-height', 'Hero fits within the viewport', timings.static));
	} else {
		out.push({
			id: 'hero-height',
			name: 'Hero fits within the viewport',
			status: 'fail',
			category: 'usability_ux',
			severity: 'medium',
			title: 'The hero section is taller than the screen, hiding content',
			description:
				`The top hero/banner section is about ${m.hero.ratio}× the height of the browser window ` +
				`(${m.hero.heroPx}px tall versus a ${m.hero.viewportPx}px viewport). Visitors have to scroll ` +
				`past an oversized banner before they reach the actual content or any call to action, which ` +
				`weakens first impressions and pushes key information below the fold.`,
			impact:
				'Visitors must scroll past an oversized banner before seeing real content or any call to action.',
			pageSection: SECTION,
			detail: `ratio=${m.hero.ratio}`,
			durationMs: timings.static,
		});
	}

	return out;
}

function pass(id: string, name: string, durationMs: number): PatternCheckResult {
	return { id, name, status: 'pass', durationMs };
}
function skip(id: string, name: string, durationMs: number): PatternCheckResult {
	return { id, name, status: 'skip', durationMs };
}

// ─── Check 6: button text visibility on hover / focus ─────────────────────────

/** Read the state that tells us whether a button's text is visible right now. */
function readButtonState(el: Element): {
	hasText: boolean;
	opacity: number;
	hidden: boolean;
	w: number;
	h: number;
	top: number;
	colorEqualsBg: boolean;
} {
	const parse = (input: string): [number, number, number, number] | null => {
		const m = input.match(
			/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+))?/i,
		);
		return m
			? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])]
			: null;
	};
	const s = getComputedStyle(el);
	const r = (el as HTMLElement).getBoundingClientRect();
	const fg = parse(s.color);
	let bg: [number, number, number, number] | null = null;
	let node: Element | null = el;
	while (node && !bg) {
		const c = parse(getComputedStyle(node).backgroundColor);
		if (c && c[3] >= 0.5) bg = c;
		node = node.parentElement;
	}
	const colorEqualsBg =
		!!fg &&
		!!bg &&
		Math.abs(fg[0] - bg[0]) <= 8 &&
		Math.abs(fg[1] - bg[1]) <= 8 &&
		Math.abs(fg[2] - bg[2]) <= 8 &&
		fg[3] > 0.05;
	const opacity = Number(s.opacity || '1');
	return {
		hasText: (el.textContent ?? '').trim().length > 0,
		opacity,
		hidden:
			s.visibility === 'hidden' ||
			s.display === 'none' ||
			opacity < 0.05 ||
			r.width < 2 ||
			r.height < 2,
		w: Math.round(r.width),
		h: Math.round(r.height),
		top: Math.round(r.top),
		colorEqualsBg,
	};
}

type ButtonState = ReturnType<typeof readButtonState>;

async function checkButtonStates(
	page: Page,
	startedAt: number,
	cutoff: number,
	maxButtons: number,
): Promise<PatternCheckResult> {
	const id = 'button-state-visibility';
	const name = 'Button text stays visible when hovered/focused';
	try {
		const handles = await page.$$('button, [role="button"], a[class*="btn" i], a[class*="button" i]');
		let checked = 0;
		for (const handle of handles) {
			if (checked >= maxButtons) break;
			const base: ButtonState | null = await handle
				.evaluate(readButtonState)
				.catch(() => null);
			// Skip non-text/hidden buttons and anything below this tier's scope cutoff.
			if (!base || !base.hasText || base.hidden || base.colorEqualsBg) continue;
			if (base.top > cutoff) continue;
			checked += 1;

			const broke = (st: ButtonState | null): boolean =>
				!!st && st.hasText && (st.hidden || st.colorEqualsBg);

			await handle
				.hover({ timeout: STATE_ACTION_TIMEOUT_MS })
				.catch(() => {});
			const hovered: ButtonState | null = await handle
				.evaluate(readButtonState)
				.catch(() => null);

			await handle.evaluate((el) => (el as HTMLElement).focus?.()).catch(() => {});
			const focused: ButtonState | null = await handle
				.evaluate(readButtonState)
				.catch(() => null);

			// Move focus/hover away to restore baseline for the screenshot already taken.
			await page.mouse.move(0, 0).catch(() => {});
			await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.()).catch(() => {});

			if (broke(hovered) || broke(focused)) {
				const label = await handle
					.evaluate((el) => (el.textContent ?? '').trim().slice(0, 40))
					.catch(() => '');
				const state = broke(hovered) ? 'hovered' : 'focused';
				return {
					id,
					name,
					status: 'fail',
					category: 'ui_bugs',
					severity: 'high',
					title: 'Button text disappears when hovered or focused',
					description:
						`The "${label || 'button'}" button shows its label normally, but the text becomes ` +
						`invisible when the button is ${state} (the text colour collapses into the background or ` +
						`the element is hidden). People who hover or tab to the button can no longer read what it ` +
						`does at the exact moment they are about to click it.`,
					impact:
						'The button label vanishes right when a visitor interacts with it, so they can not tell what it does.',
					pageSection: SECTION,
					detail: `state=${state}`,
					durationMs: Date.now() - startedAt,
				};
			}
		}
		if (checked === 0) return skip(id, name, Date.now() - startedAt);
		return pass(id, name, Date.now() - startedAt);
	} catch (error) {
		return {
			id,
			name,
			status: 'error',
			detail: error instanceof Error ? error.message : 'button state error',
			durationMs: Date.now() - startedAt,
		};
	}
}

// ─── Scope helper ─────────────────────────────────────────────────────────────

/**
 * In-page: y-pixel marking the bottom of the "first impression" — the hero plus
 * the next ~2 top-level sections. Bounded to [1.5×, ~4000px] of the viewport so
 * it always covers the hero and first sections but never the whole page. Used to
 * scope free-tier checks to where conversion-critical issues concentrate.
 */
function measureTopRegionCutoff(): number {
	const vp = window.innerHeight || 900;
	const main = document.querySelector('main') || document.body;
	const blocks = (Array.from(main.children) as HTMLElement[]).filter(
		(el) => el.getBoundingClientRect().height > 40,
	);
	const topBlocks = blocks.slice(0, 3); // hero + ~2 sections
	let cutoff = vp * 1.5;
	if (topBlocks.length > 0) {
		cutoff = Math.max(
			...topBlocks.map((el) => el.getBoundingClientRect().bottom),
		);
	}
	return Math.min(Math.max(cutoff, vp * 1.5), 4000);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function collectPatternChecks(
	page: Page,
	pageUrl: string,
	options: {
		isHomepage: boolean;
		links?: LinksResult;
		/** 'top' (free) limits checks to the hero + first sections; 'full' (paid) scans the whole page. */
		scope?: 'top' | 'full';
		timing?: { scanId?: string; pageUrl?: string; tier?: string };
	},
): Promise<PatternChecksPayload> {
	const startedAt = Date.now();
	const results: PatternCheckResult[] = [];
	const scope = options.scope ?? 'full';

	// For the 'top' (free) scope, compute the y-pixel below which content is out of
	// scope: the bottom of the hero plus the next ~2 top-level sections, bounded so
	// it always covers the first impression but never the whole page. 'full' uses a
	// large sentinel (Infinity is not JSON-serializable across page.evaluate).
	const FULL_SCOPE_CUTOFF = 1_000_000_000;
	let cutoff = FULL_SCOPE_CUTOFF;
	if (scope === 'top') {
		cutoff = await page
			.evaluate(measureTopRegionCutoff)
			.catch(() => FULL_SCOPE_CUTOFF);
	}

	// Checks 1-5: one static evaluate, guarded by a Node timeout.
	const staticStarted = Date.now();
	let measurements: StaticMeasurements | null = null;
	try {
		measurements = await Promise.race([
			page.evaluate(staticMeasureInPage, { cutoff }),
			new Promise<null>((resolve) => setTimeout(() => resolve(null), STATIC_EVAL_TIMEOUT_MS)),
		]);
	} catch {
		measurements = null;
	}
	const staticMs = Date.now() - staticStarted;

	if (measurements) {
		results.push(...buildStaticResults(measurements, { static: staticMs }));
	} else {
		results.push({
			id: 'static-pattern-checks',
			name: 'Static homepage pattern checks',
			status: 'error',
			detail: 'static evaluate timed out or failed',
			durationMs: staticMs,
		});
	}

	// Check 6: interactive hover/focus probe (mutates element state → runs last).
	// This loop (hover + focus per button) dominates the phase, so free checks
	// fewer buttons — the top region rarely has more than a couple of CTAs.
	const maxButtons = scope === 'top' ? 3 : MAX_BUTTONS_CHECKED;
	results.push(await checkButtonStates(page, Date.now(), cutoff, maxButtons));

	const durationMs = Date.now() - startedAt;
	logScanTiming('pattern_checks', durationMs, {
		...options.timing,
		pageUrl,
		scope,
		ok: true,
		failed: results.filter((r) => r.status === 'fail').length,
	});

	return { pageUrl, results, durationMs };
}
