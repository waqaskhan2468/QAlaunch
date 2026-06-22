import type { Page } from 'playwright-core';
import sharp from 'sharp';
import type { IssueCategory, IssueSeverity } from '@/lib/scan/ai/types';
import type { LinksResult } from '../types/scan.types';
import { logScanTiming } from './scan-timing';

/**
 * Deterministic homepage pattern checks — the "verified pattern" layer.
 *
 * Unlike interactionTests / interactionProbes (which feed observations to the AI
 * for judgement), these are 100% programmatic: a failing check carries a fixed,
 * factual issue payload that becomes a verified_pattern issue directly.
 *
 * Reliability invariants enforced here (see the production audit):
 *  - Contrast is judged from ACTUAL RENDERED PIXELS sampled from a screenshot,
 *    not the CSS background-color property (which is wrong for image / gradient /
 *    overlay backgrounds).
 *  - The hero check measures the real hero element (descending past full-page
 *    wrappers) and is evaluated separately for desktop and mobile, each labelled.
 *  - Every failing check captures a cropped screenshot of its own element with a
 *    red highlight box. A check that cannot produce a clear crop is flagged with
 *    `cropReliable: false` — an inability to show the finding is treated as a
 *    reliability concern on the check itself.
 *
 * Runs in Phase 3 on the idle desktop page (after screenshots).
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type PatternCheckStatus = 'pass' | 'fail' | 'skip' | 'error';

type Rect = { x: number; y: number; width: number; height: number };

/**
 * One check result. When `status === 'fail'` the issue-payload fields are
 * populated and become a verified_pattern issue verbatim. `cropScreenshotUrl`
 * holds the highlighted evidence crop; `cropReliable === false` means the check
 * could NOT produce a crop of its own finding (a reliability red flag).
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
	detail?: string;
	device?: 'desktop' | 'mobile';
	/** Highlighted crop of the offending element, captured at check time. */
	cropScreenshotUrl?: string;
	/** False when a failing check could not produce a clear visual crop. */
	cropReliable?: boolean;
	/** Offending element rect (page coords, scrollY=0) — used to build the crop. */
	rect?: Rect;
	durationMs: number;
};

export type PatternChecksPayload = {
	pageUrl: string;
	results: PatternCheckResult[];
	durationMs: number;
};

/** Upload a crop buffer and return its URL (provided by the scan writer). */
export type CropUploader = (checkId: string, buffer: Buffer) => Promise<string | null>;

// Generous: under a congested Browserbase CDP channel a DOM-only evaluate can
// still take several seconds. A too-tight race here makes checks 1-4 fail closed
// (emitting an error result and losing coverage), so we allow real headroom.
const STATIC_EVAL_TIMEOUT_MS = 12_000;
const STATE_ACTION_TIMEOUT_MS = 1_500;
// Clip screenshots (contrast sampling + evidence crops) can cover tall elements,
// so they need more headroom than a hover action.
const CLIP_SCREENSHOT_TIMEOUT_MS = 6_000;
// Settle window after triggering :hover / :focus so we read the SETTLED state and
// not a mid-transition frame (class-(b) fix from the deterministic-check audit).
const HOVER_SETTLE_MS = 160;
const MAX_BUTTONS_CHECKED = 6;
// Bound the pixel-contrast verification — each candidate is a screenshot + decode.
const MAX_CONTRAST_CANDIDATES = 12;
// Crop padding and size caps for evidence images.
const CROP_PAD_PX = 10;
const MAX_CROP_WIDTH_PX = 1200;
const MAX_CROP_HEIGHT_PX = 1200;
// Device viewports for the hero split.
const DESKTOP_VP = { width: 1440, height: 900 };
const MOBILE_VP = { width: 390, height: 844 };

// ─── Static DOM measurements (checks 1-4 candidates) ──────────────────────────

type ContrastCandidate = {
	rect: Rect;
	fg: [number, number, number];
	large: boolean;
	text: string;
	cssRatio: number;
};

type StaticMeasurements = {
	logo: { found: boolean; linkedHome: boolean; hint: string; rect: Rect | null } | null;
	contrast: { checked: number; candidates: ContrastCandidate[] };
	nav: {
		currentFound: boolean;
		distinct: boolean;
		total: number;
		currentLabel: string;
		rect: Rect | null;
	} | null;
	destinations: {
		mismatches: Array<{
			kind: string;
			platform: string;
			href: string;
			label: string;
			rect: Rect | null;
		}>;
	};
};

/**
 * Checks 1-4 in a single in-page pass. Contrast here only GATHERS candidates
 * (visible text whose CSS-estimated ratio is below the WCAG threshold) plus their
 * rects — the actual verdict is computed Node-side from rendered pixels.
 */
function staticMeasureInPage(arg: { cutoff: number; maxCandidates: number }): StaticMeasurements {
	const cutoff = arg?.cutoff ?? Number.POSITIVE_INFINITY;
	const maxCandidates = arg?.maxCandidates ?? 12;
	window.scrollTo(0, 0); // ensure getBoundingClientRect == absolute page coords
	const round = (n: number) => Math.round(n * 100) / 100;
	const withinCutoff = (el: Element): boolean =>
		(el as HTMLElement).getBoundingClientRect().top <= cutoff;
	const rectOf = (el: Element): Rect => {
		const r = (el as HTMLElement).getBoundingClientRect();
		return {
			x: Math.max(0, Math.round(r.left)),
			y: Math.max(0, Math.round(r.top)),
			width: Math.round(r.width),
			height: Math.round(r.height),
		};
	};

	function parseColor(input: string): [number, number, number, number] | null {
		const m = input.match(
			/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+))?/i,
		);
		if (!m) return null;
		return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
	}
	function channelLum(c: number): number {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
	}
	function luminance(r: number, g: number, b: number): number {
		return 0.2126 * channelLum(r) + 0.7152 * channelLum(g) + 0.0722 * channelLum(b);
	}
	function contrastRatio(fg: [number, number, number], bg: [number, number, number]): number {
		const l1 = luminance(fg[0], fg[1], fg[2]);
		const l2 = luminance(bg[0], bg[1], bg[2]);
		return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
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
	function effectiveBg(el: Element): [number, number, number] {
		let node: Element | null = el;
		while (node) {
			const bg = parseColor(getComputedStyle(node).backgroundColor);
			if (bg && bg[3] >= 0.5) return [bg[0], bg[1], bg[2]];
			node = node.parentElement;
		}
		return [255, 255, 255];
	}
	function isVisible(el: Element): boolean {
		const r = (el as HTMLElement).getBoundingClientRect();
		if (r.width < 2 || r.height < 2) return false;
		const s = getComputedStyle(el);
		return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity || '1') > 0.05;
	}
	function hint(el: Element): string {
		const tag = el.tagName.toLowerCase();
		const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : '';
		const cls =
			typeof (el as HTMLElement).className === 'string' && (el as HTMLElement).className.trim()
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
	// The most reliable logo signal is the BRAND ANCHOR: the first visible header
	// link that wraps an image/svg (the top-left brand mark). We check ITS href, so
	// a wordmark inside `<a aria-label="Home" href="/">` correctly passes even when
	// some other svg on the page has "logo" in an attribute (the old false positive).
	// Only when there is no media-wrapping header link do we fall back to a bare
	// logo image (the genuine "logo not linked" case).
	let logo: StaticMeasurements['logo'] = null;
	{
		const header = document.querySelector('header, [role="banner"], nav') || document.body;
		const linksHome = (a: HTMLAnchorElement): boolean => {
			const u = resolveHref(a);
			if (!u || u.origin !== origin) return false;
			const p = u.pathname.replace(/\/+$/, '') || '/';
			return p === '/' || p === currentPath;
		};
		// Header links that wrap an image/svg — logo/brand-mark candidates. A header
		// can contain a PARTNER/PROMO logo (e.g. an external "powered by" mark) before
		// the site's own brand, so we don't assume the first one is the logo: if ANY
		// logo-anchor points home, the site's logo is linked home (pass). We only fail
		// when a logo mark exists but none of its links go home.
		const headerAnchors = (Array.from(header.querySelectorAll('a')) as HTMLAnchorElement[]).filter(
			isVisible,
		);
		const mediaAnchors = headerAnchors.filter((a) => a.querySelector('img, svg'));

		let logoEl: HTMLElement | null = null;
		let linkedHome = false;
		const homeAnchor = mediaAnchors.find(linksHome);
		if (homeAnchor) {
			logoEl = homeAnchor;
			linkedHome = true;
		} else if (mediaAnchors.length > 0) {
			logoEl = mediaAnchors[0];
			linkedHome = false;
		} else {
			// Logo not wrapped in any header link — a bare image/svg.
			const media = (Array.from(header.querySelectorAll('img, svg')) as HTMLElement[]).filter(isVisible);
			logoEl =
				media.find((el) => {
					const hay = `${el.id} ${el.getAttribute('alt') ?? ''} ${el.getAttribute('aria-label') ?? ''}`.toLowerCase();
					return hay.includes('logo') || hay.includes('brand');
				}) ??
				media[0] ??
				null;
			const anchor = logoEl?.closest('a') as HTMLAnchorElement | null;
			linkedHome = anchor ? linksHome(anchor) : false;
		}

		if (logoEl) {
			logo = { found: true, linkedHome, hint: hint(logoEl), rect: rectOf(logoEl) };
		}
	}

	// — Check 2: text-contrast CANDIDATES (CSS pre-filter; verdict is pixel-based) —
	const candidates: ContrastCandidate[] = [];
	let checkedCount = 0;
	{
		const all = Array.from(document.querySelectorAll('body *')) as HTMLElement[];
		for (const el of all) {
			if (checkedCount >= 800) break;
			const direct = Array.from(el.childNodes).some(
				(n) => n.nodeType === 3 && (n.textContent ?? '').trim().length >= 3,
			);
			if (!direct || !isVisible(el) || !withinCutoff(el)) continue;
			const s = getComputedStyle(el);
			const fg = parseColor(s.color);
			if (!fg) continue;
			checkedCount += 1;
			const bg = effectiveBg(el);
			const cssRatio = round(contrastRatio(composite(fg, bg), bg));
			const fontPx = parseFloat(s.fontSize) || 16;
			const weight = parseInt(s.fontWeight, 10) || 400;
			const large = fontPx >= 24 || (fontPx >= 18.66 && weight >= 700);
			const threshold = large ? 3 : 4.5;
			// Only borderline/failing-by-CSS elements are worth a pixel screenshot.
			if (cssRatio < threshold && candidates.length < 40) {
				candidates.push({
					rect: rectOf(el),
					fg: [fg[0], fg[1], fg[2]],
					large,
					text: (el.textContent ?? '').trim().slice(0, 40),
					cssRatio,
				});
			}
		}
	}

	// — Check 3: current nav item active state —
	let nav: StaticMeasurements['nav'] = null;
	{
		const navRoot = document.querySelector('nav, header [role="navigation"], header') || null;
		if (navRoot) {
			const links = (Array.from(navRoot.querySelectorAll('a[href]')) as HTMLAnchorElement[]).filter(
				isVisible,
			);
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
					const sameAsAll = others.length > 0 && others.every((a) => sig(a) === currentSig);
					const distinct = Boolean(ariaCurrent) || !sameAsAll;
					nav = {
						currentFound: true,
						distinct,
						total: links.length,
						currentLabel: (current.textContent ?? '').trim().slice(0, 40),
						rect: rectOf(current),
					};
				} else {
					nav = { currentFound: false, distinct: false, total: links.length, currentLabel: '', rect: null };
				}
			}
		}
	}

	// — Check 4: link/icon destination mismatch (social + label-vs-host) —
	const destMismatches: StaticMeasurements['destinations']['mismatches'] = [];
	{
		// Each keyword regex must be a STRONG signal of the platform. We deliberately
		// avoid the bare letter "x" (matches stray class names) and match Twitter/X
		// only via "twitter". Detection reads ONLY icon/label attributes — never the
		// visible text or the href — so an internal link whose text or query string
		// happens to contain a platform name (e.g. HN's "?site=github.com", a "/learn"
		// link) is not misclassified as a social icon.
		const SOCIAL: Array<{ name: string; kw: RegExp; hosts: string[] }> = [
			{ name: 'Facebook', kw: /facebook/, hosts: ['facebook.com', 'fb.com'] },
			{ name: 'Instagram', kw: /instagram/, hosts: ['instagram.com'] },
			{ name: 'X (Twitter)', kw: /twitter/, hosts: ['twitter.com', 'x.com'] },
			{ name: 'LinkedIn', kw: /linkedin/, hosts: ['linkedin.com'] },
			{ name: 'YouTube', kw: /youtube/, hosts: ['youtube.com', 'youtu.be'] },
			{ name: 'TikTok', kw: /tiktok/, hosts: ['tiktok.com'] },
			{ name: 'GitHub', kw: /github/, hosts: ['github.com'] },
			{ name: 'Pinterest', kw: /pinterest/, hosts: ['pinterest.com'] },
		];
		const anchors = (Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[]).filter(
			(a) => isVisible(a) && withinCutoff(a),
		);
		for (const a of anchors) {
			if (destMismatches.length >= 6) break;
			// Icon/label signals ONLY — no textContent, no href.
			const label = `${a.getAttribute('aria-label') ?? ''} ${a.getAttribute('title') ?? ''} ${a.className || ''} ${a.querySelector('use')?.getAttribute('href') ?? ''} ${a.querySelector('img')?.getAttribute('alt') ?? ''}`.toLowerCase();
			const platform = SOCIAL.find((p) => p.kw.test(label));
			if (!platform) continue;
			const u = resolveHref(a);
			const rawHref = a.getAttribute('href') ?? '';
			const placeholder = rawHref === '#' || rawHref === '' || rawHref.startsWith('javascript:');
			const host = u ? u.hostname.replace(/^www\./, '') : '';
			const matches = platform.hosts.some((h) => host === h || host.endsWith(`.${h}`));
			if (placeholder || (u && !matches)) {
				destMismatches.push({
					kind: 'social',
					platform: platform.name,
					href: placeholder ? rawHref || '(empty)' : u ? u.href : rawHref,
					label: (a.getAttribute('aria-label') ?? platform.name).trim().slice(0, 40),
					rect: rectOf(a),
				});
			}
		}
	}

	return {
		logo,
		contrast: { checked: checkedCount, candidates: candidates.slice(0, maxCandidates) },
		nav,
		destinations: { mismatches: destMismatches },
	};
}

// ─── Hero measurement (run per-device, Node-orchestrated) ─────────────────────

type HeroMeasurement = { heroPx: number; viewportPx: number; ratio: number; hint: string; rect: Rect } | null;

/**
 * Measure the real hero/banner element. Fixes the historical "measures the whole
 * page" bug by (1) preferring explicit hero selectors and (2) for the structural
 * fallback, DESCENDING past any near-full-page wrapper to the first genuine
 * section instead of measuring the page-height container.
 */
function measureHeroInPage(): HeroMeasurement {
	window.scrollTo(0, 0);
	const vp = window.innerHeight || 900;
	const docH = Math.max(
		document.documentElement?.scrollHeight ?? 0,
		document.body?.scrollHeight ?? 0,
		1,
	);
	const round = (n: number) => Math.round(n * 100) / 100;
	const hint = (el: Element): string => {
		const tag = el.tagName.toLowerCase();
		const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : '';
		const cls =
			typeof (el as HTMLElement).className === 'string' && (el as HTMLElement).className.trim()
				? `.${(el as HTMLElement).className.trim().split(/\s+/).slice(0, 2).join('.')}`
				: '';
		return `${tag}${id}${cls}`.slice(0, 80);
	};

	let el: HTMLElement | null = document.querySelector(
		'[class*="hero" i], [id*="hero" i], [class*="banner" i], [class*="jumbotron" i], [class*="masthead" i]',
	);

	if (!el) {
		let container: Element = document.querySelector('main') || document.body;
		for (let depth = 0; depth < 5; depth++) {
			const kids = (Array.from(container.children) as HTMLElement[]).filter(
				(k) => k.getBoundingClientRect().height > 40,
			);
			if (kids.length === 0) break;
			const first = kids[0];
			const h = first.getBoundingClientRect().height;
			// Descend into wrappers rather than measuring them as the hero:
			//  - a child spanning almost the whole document, or
			//  - a child far taller than any real hero (> 2.5× viewport) that still has
			//    multiple children (i.e. a section stack, not a single hero).
			// Erring toward descending avoids the false-positive "hero = whole page" bug.
			const looksLikeWrapper =
				(h > docH * 0.9 || h > vp * 2.5) && first.children.length > 1;
			if (looksLikeWrapper) {
				container = first;
				continue;
			}
			el = first;
			break;
		}
	}

	if (!el) return null;
	const r = el.getBoundingClientRect();
	const heroPx = Math.round(r.height);
	return {
		heroPx,
		viewportPx: vp,
		ratio: round(heroPx / vp),
		hint: hint(el),
		rect: {
			x: Math.max(0, Math.round(r.left)),
			y: Math.max(0, Math.round(r.top)),
			width: Math.round(r.width),
			height: Math.round(r.height),
		},
	};
}

// ─── Node-side issue builders ─────────────────────────────────────────────────

const SECTION = 'Homepage';

function pass(id: string, name: string, durationMs: number): PatternCheckResult {
	return { id, name, status: 'pass', durationMs };
}
function skip(id: string, name: string, durationMs: number): PatternCheckResult {
	return { id, name, status: 'skip', durationMs };
}

function buildLogoResult(m: StaticMeasurements, dur: number): PatternCheckResult {
	if (!m.logo || !m.logo.found) return skip('logo-home-link', 'Logo links to homepage', dur);
	if (m.logo.linkedHome) return pass('logo-home-link', 'Logo links to homepage', dur);
	return {
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
		rect: m.logo.rect ?? undefined,
		durationMs: dur,
	};
}

function buildNavResult(m: StaticMeasurements, dur: number): PatternCheckResult {
	if (!m.nav || !m.nav.currentFound) return skip('nav-active-state', 'Current nav item is highlighted', dur);
	if (m.nav.distinct) return pass('nav-active-state', 'Current nav item is highlighted', dur);
	return {
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
		rect: m.nav.rect ?? undefined,
		durationMs: dur,
	};
}

function buildDestinationResult(m: StaticMeasurements, dur: number): PatternCheckResult {
	if (m.destinations.mismatches.length === 0) {
		return pass('link-destination', 'Links point to their expected destination', dur);
	}
	const first = m.destinations.mismatches[0];
	const list = m.destinations.mismatches.slice(0, 3).map((x) => `${x.platform} → ${x.href}`).join(', ');
	return {
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
		impact: 'People clicking these links end up somewhere other than the destination the link advertises.',
		pageSection: SECTION,
		detail: list,
		rect: first.rect ?? undefined,
		durationMs: dur,
	};
}

function buildHeroResult(hero: HeroMeasurement, device: 'desktop' | 'mobile', dur: number): PatternCheckResult {
	const id = `hero-height-${device}`;
	const name = `Hero fits within the ${device} viewport`;
	if (!hero) return skip(id, name, dur);
	// Different thresholds per device: phones legitimately use taller heroes.
	// An UPPER bound guards the wrong-element failure mode: a ratio far beyond any
	// plausible hero means we measured a content wrapper / the whole page, not a
	// hero — so we SKIP (not confident) rather than emit a false positive. The
	// crop evidence lets a human confirm the borderline in-range cases.
	const lower = device === 'mobile' ? 2.5 : 1.75;
	const upper = device === 'mobile' ? 4.5 : 3.0;
	if (hero.ratio <= lower) return pass(id, name, dur);
	if (hero.ratio > upper) {
		return {
			...skip(id, name, dur),
			detail: `device=${device} ratio=${hero.ratio} exceeds plausible-hero bound (${upper}); likely a wrapper/whole-page — not flagged`,
		};
	}
	return {
		id,
		name,
		status: 'fail',
		category: device === 'mobile' ? 'responsiveness' : 'usability_ux',
		severity: 'medium',
		title: `The hero section is taller than the ${device} screen, hiding content`,
		description:
			`On ${device} the top hero/banner section is about ${hero.ratio}× the height of the screen ` +
			`(${hero.heroPx}px tall versus a ${hero.viewportPx}px viewport). Visitors have to scroll past an ` +
			`oversized banner before they reach the actual content or any call to action, which weakens the ` +
			`first impression and pushes key information below the fold.`,
		impact:
			`On ${device}, visitors must scroll past an oversized banner before seeing real content or a call to action.`,
		pageSection: SECTION,
		detail: `device=${device} ratio=${hero.ratio} hero=${hero.hint}`,
		device,
		rect: hero.rect,
		durationMs: dur,
	};
}

// ─── Pixel-based contrast verification (Node side) ────────────────────────────

function clampRect(rect: Rect, pad: number, vw: number): Rect {
	const x = Math.max(0, rect.x - pad);
	const y = Math.max(0, rect.y - pad);
	const width = Math.min(rect.width + pad * 2, MAX_CROP_WIDTH_PX, Math.max(1, vw - x));
	const height = Math.min(rect.height + pad * 2, MAX_CROP_HEIGHT_PX);
	return { x, y, width: Math.max(1, width), height: Math.max(1, height) };
}

async function screenshotClip(page: Page, clip: Rect): Promise<Buffer | null> {
	try {
		const buf = await page.screenshot({
			clip,
			type: 'jpeg',
			quality: 80,
			animations: 'disabled',
			timeout: CLIP_SCREENSHOT_TIMEOUT_MS,
		});
		return buf?.length ? buf : null;
	} catch {
		return null;
	}
}

function relLum(r: number, g: number, b: number): number {
	const f = (c: number) => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
	};
	return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratioOf(a: [number, number, number], b: [number, number, number]): number {
	const la = relLum(a[0], a[1], a[2]);
	const lb = relLum(b[0], b[1], b[2]);
	return Math.round(((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)) * 100) / 100;
}

/**
 * Estimate the rendered background behind text from a screenshot crop: decode raw
 * pixels and average those NOT close to the foreground colour (the non-glyph
 * pixels). This reflects an image/gradient/overlay background — what the CSS
 * `background-color` property cannot.
 */
async function estimateBgFromCrop(
	buffer: Buffer,
	fg: [number, number, number],
): Promise<[number, number, number] | null> {
	try {
		const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
		const ch = info.channels;
		const total = info.width * info.height;
		const step = Math.max(1, Math.floor(total / 4000)); // sample ~4000 px
		let r = 0, g = 0, b = 0, n = 0;
		let ar = 0, ag = 0, ab = 0, an = 0;
		for (let i = 0; i < total; i += step) {
			const o = i * ch;
			const pr = data[o], pg = data[o + 1], pb = data[o + 2];
			ar += pr; ag += pg; ab += pb; an += 1;
			const dist = Math.abs(pr - fg[0]) + Math.abs(pg - fg[1]) + Math.abs(pb - fg[2]);
			if (dist > 90) { r += pr; g += pg; b += pb; n += 1; } // not a glyph pixel
		}
		if (n >= an * 0.15) return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
		if (an > 0) return [Math.round(ar / an), Math.round(ag / an), Math.round(ab / an)]; // fallback: whole-crop average
		return null;
	} catch {
		return null;
	}
}

// ─── Crop + red-box evidence ──────────────────────────────────────────────────

/** Composite a red highlight box over a crop buffer at the element's position. */
async function drawHighlight(buffer: Buffer, boxLeft: number, boxTop: number, boxW: number, boxH: number): Promise<Buffer> {
	const meta = await sharp(buffer).metadata();
	const W = meta.width ?? boxLeft + boxW;
	const H = meta.height ?? boxTop + boxH;
	const x = Math.max(1, Math.min(boxLeft, W - 2));
	const y = Math.max(1, Math.min(boxTop, H - 2));
	const w = Math.max(2, Math.min(boxW, W - x - 1));
	const h = Math.max(2, Math.min(boxH, H - y - 1));
	const svg = Buffer.from(
		`<svg width="${W}" height="${H}"><rect x="${x}" y="${y}" width="${w}" height="${h}" ` +
			`fill="none" stroke="#ff0033" stroke-width="3"/></svg>`,
	);
	return sharp(buffer).composite([{ input: svg, top: 0, left: 0 }]).jpeg({ quality: 80 }).toBuffer();
}

/**
 * Capture a highlighted crop of `rect` and upload it. Sets `cropScreenshotUrl` on
 * success; sets `cropReliable: false` (a reliability concern) if it cannot produce
 * a clear crop. `preBuffer` reuses an already-captured clip (contrast sampling).
 */
async function attachCrop(
	result: PatternCheckResult,
	rect: Rect,
	page: Page,
	upload: CropUploader | undefined,
	viewportWidth: number,
	preBuffer?: Buffer | null,
): Promise<void> {
	if (!upload) {
		result.cropReliable = false;
		return;
	}
	const clip = clampRect(rect, CROP_PAD_PX, viewportWidth);
	const base = preBuffer ?? (await screenshotClip(page, clip));
	if (!base) {
		result.cropReliable = false;
		result.detail = `${result.detail ?? ''} [crop_failed:no_screenshot]`.trim();
		return;
	}
	try {
		const boxLeft = Math.round(rect.x - clip.x);
		const boxTop = Math.round(rect.y - clip.y);
		const annotated = await drawHighlight(base, boxLeft, boxTop, rect.width, rect.height);
		const url = await upload(result.id, annotated);
		if (url) {
			result.cropScreenshotUrl = url;
			result.cropReliable = true;
		} else {
			result.cropReliable = false;
			result.detail = `${result.detail ?? ''} [crop_failed:upload]`.trim();
		}
	} catch {
		result.cropReliable = false;
		result.detail = `${result.detail ?? ''} [crop_failed:render]`.trim();
	}
}

// ─── Check 6: button text visibility on hover / focus ─────────────────────────

function readButtonState(el: Element): {
	hasText: boolean;
	opacity: number;
	hidden: boolean;
	w: number;
	h: number;
	top: number;
	left: number;
	colorEqualsBg: boolean;
} {
	const parse = (input: string): [number, number, number, number] | null => {
		const m = input.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+))?/i);
		return m ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])] : null;
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
		!!fg && !!bg &&
		Math.abs(fg[0] - bg[0]) <= 8 && Math.abs(fg[1] - bg[1]) <= 8 && Math.abs(fg[2] - bg[2]) <= 8 &&
		fg[3] > 0.05;
	const opacity = Number(s.opacity || '1');
	return {
		hasText: (el.textContent ?? '').trim().length > 0,
		opacity,
		hidden: s.visibility === 'hidden' || s.display === 'none' || opacity < 0.05 || r.width < 2 || r.height < 2,
		w: Math.round(r.width),
		h: Math.round(r.height),
		top: Math.max(0, Math.round(r.top)),
		left: Math.max(0, Math.round(r.left)),
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
			const base: ButtonState | null = await handle.evaluate(readButtonState).catch(() => null);
			if (!base || !base.hasText || base.hidden || base.colorEqualsBg) continue;
			if (base.top > cutoff) continue;
			checked += 1;

			const broke = (st: ButtonState | null): boolean =>
				!!st && st.hasText && (st.hidden || st.colorEqualsBg);

			await handle.hover({ timeout: STATE_ACTION_TIMEOUT_MS }).catch(() => {});
			await page.waitForTimeout(HOVER_SETTLE_MS); // let the :hover transition finish
			const hovered: ButtonState | null = await handle.evaluate(readButtonState).catch(() => null);
			await handle.evaluate((el) => (el as HTMLElement).focus?.()).catch(() => {});
			await page.waitForTimeout(HOVER_SETTLE_MS); // let the :focus transition finish
			const focused: ButtonState | null = await handle.evaluate(readButtonState).catch(() => null);
			await page.mouse.move(0, 0).catch(() => {});
			await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.()).catch(() => {});

			if (broke(hovered) || broke(focused)) {
				const label = await handle.evaluate((el) => (el.textContent ?? '').trim().slice(0, 40)).catch(() => '');
				const state = broke(hovered) ? 'hovered' : 'focused';
				return {
					id,
					name,
					status: 'fail',
					category: 'ui_bugs',
					severity: 'high',
					title: 'Button text disappears when hovered or focused',
					description:
						`The "${label || 'button'}" button shows its label normally, but the text becomes invisible ` +
						`when the button is ${state} (the text colour collapses into the background or the element is ` +
						`hidden). People who hover or tab to the button can no longer read what it does at the exact ` +
						`moment they are about to click it.`,
					impact:
						'The button label vanishes right when a visitor interacts with it, so they can not tell what it does.',
					pageSection: SECTION,
					detail: `state=${state}`,
					rect: { x: base.left, y: base.top, width: base.w, height: base.h },
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

function measureTopRegionCutoff(): number {
	const vp = window.innerHeight || 900;
	const main = document.querySelector('main') || document.body;
	const blocks = (Array.from(main.children) as HTMLElement[]).filter(
		(el) => el.getBoundingClientRect().height > 40,
	);
	const topBlocks = blocks.slice(0, 3);
	let cutoff = vp * 1.5;
	if (topBlocks.length > 0) {
		cutoff = Math.max(...topBlocks.map((el) => el.getBoundingClientRect().bottom));
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
		scope?: 'top' | 'full';
		uploadCrop?: CropUploader;
		timing?: { scanId?: string; pageUrl?: string; tier?: string };
	},
): Promise<PatternChecksPayload> {
	const startedAt = Date.now();
	const results: PatternCheckResult[] = [];
	const scope = options.scope ?? 'full';
	const upload = options.uploadCrop;

	await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});

	const FULL_SCOPE_CUTOFF = 1_000_000_000;
	let cutoff = FULL_SCOPE_CUTOFF;
	if (scope === 'top') {
		cutoff = await page.evaluate(measureTopRegionCutoff).catch(() => FULL_SCOPE_CUTOFF);
	}

	// Checks 1-4: one static evaluate.
	const staticStarted = Date.now();
	let m: StaticMeasurements | null = null;
	try {
		m = await Promise.race([
			page.evaluate(staticMeasureInPage, { cutoff, maxCandidates: MAX_CONTRAST_CANDIDATES }),
			new Promise<null>((resolve) => setTimeout(() => resolve(null), STATIC_EVAL_TIMEOUT_MS)),
		]);
	} catch {
		m = null;
	}
	const staticMs = Date.now() - staticStarted;
	const vw = page.viewportSize()?.width ?? DESKTOP_VP.width;

	if (!m) {
		results.push({
			id: 'static-pattern-checks',
			name: 'Static homepage pattern checks',
			status: 'error',
			detail: 'static evaluate timed out or failed',
			cropReliable: false,
			durationMs: staticMs,
		});
	} else {
		const logoR = buildLogoResult(m, staticMs);
		const navR = buildNavResult(m, staticMs);
		const destR = buildDestinationResult(m, staticMs);

		// Pixel-based contrast verdict: screenshot each CSS-borderline candidate and
		// recompute contrast against the ACTUAL rendered background.
		const contrastStarted = Date.now();
		const confirmed: Array<{ ratio: number; large: boolean; text: string; rect: Rect; buffer: Buffer }> = [];
		for (const c of m.contrast.candidates) {
			if (confirmed.length >= 6) break;
			const clip = clampRect(c.rect, CROP_PAD_PX, vw);
			const buf = await screenshotClip(page, clip);
			if (!buf) continue;
			const bg = await estimateBgFromCrop(buf, c.fg);
			if (!bg) continue;
			const pixelRatio = ratioOf(c.fg, bg);
			const threshold = c.large ? 3 : 4.5;
			if (pixelRatio < threshold) {
				confirmed.push({ ratio: pixelRatio, large: c.large, text: c.text, rect: c.rect, buffer: buf });
			}
		}
		const contrastMs = staticMs + (Date.now() - contrastStarted);
		let contrastR: PatternCheckResult;
		if (m.contrast.checked === 0) {
			contrastR = skip('text-contrast', 'Text contrast meets WCAG AA', contrastMs);
		} else if (m.contrast.candidates.length === 0 || confirmed.length === 0) {
			contrastR = pass('text-contrast', 'Text contrast meets WCAG AA', contrastMs);
		} else {
			const worstNormal = Math.min(...confirmed.filter((c) => !c.large).map((c) => c.ratio), Infinity);
			const severe = Number.isFinite(worstNormal) && worstNormal < 3;
			const examples = confirmed.slice(0, 3).map((c) => `"${c.text}" (${c.ratio}:1)`).join(', ');
			contrastR = {
				id: 'text-contrast',
				name: 'Text contrast meets WCAG AA',
				status: 'fail',
				category: 'accessibility',
				severity: severe ? 'high' : 'medium',
				title: 'Some text is hard to read against its background',
				description:
					`${confirmed.length} text element(s) fall below the minimum contrast ratio for comfortable ` +
					`reading (4.5:1 normal, 3:1 large), measured from ACTUAL RENDERED PIXELS sampled at each ` +
					`element (so image, gradient, and overlay backgrounds are judged correctly). Examples: ` +
					`${examples}. Low-contrast text is hardest on mobile, in sunlight, and for reduced vision.`,
				impact: 'Some visitors struggle to read low-contrast text, especially on phones or in bright light.',
				pageSection: SECTION,
				detail: `pixel-sampled; worstNormal=${Number.isFinite(worstNormal) ? worstNormal : 'n/a'}`,
				rect: confirmed[0].rect,
				durationMs: contrastMs,
			};
			// Reuse the already-captured sampling buffer for the highlighted crop.
			await attachCrop(contrastR, confirmed[0].rect, page, upload, vw, confirmed[0].buffer);
		}

		// Button hover/focus (desktop).
		const maxButtons = scope === 'top' ? 3 : MAX_BUTTONS_CHECKED;
		const buttonR = await checkButtonStates(page, Date.now(), cutoff, maxButtons);

		// Crops for the remaining failing checks (desktop viewport), in parallel.
		await Promise.all(
			[logoR, navR, destR, buttonR].map((r) =>
				r.status === 'fail' && r.rect ? attachCrop(r, r.rect, page, upload, vw) : Promise.resolve(),
			),
		);

		results.push(logoR, contrastR, navR, destR, buttonR);
	}

	// Hero — measured separately for desktop and mobile with device-specific
	// thresholds. Desktop first (current viewport), then resize to mobile and
	// restore. Screenshots/crops above already ran at the desktop viewport.
	const desktopHero = await page.evaluate(measureHeroInPage).catch(() => null);
	const desktopHeroR = buildHeroResult(desktopHero, 'desktop', Date.now() - startedAt);
	if (desktopHeroR.status === 'fail' && desktopHeroR.rect) {
		await attachCrop(desktopHeroR, desktopHeroR.rect, page, upload, vw);
	}
	results.push(desktopHeroR);

	let mobileHero: HeroMeasurement = null;
	try {
		await page.setViewportSize(MOBILE_VP);
		await page.waitForTimeout(250);
		mobileHero = await page.evaluate(measureHeroInPage).catch(() => null);
		const mobileHeroR = buildHeroResult(mobileHero, 'mobile', Date.now() - startedAt);
		if (mobileHeroR.status === 'fail' && mobileHeroR.rect) {
			await attachCrop(mobileHeroR, mobileHeroR.rect, page, upload, MOBILE_VP.width);
		}
		results.push(mobileHeroR);
	} catch {
		results.push({
			id: 'hero-height-mobile',
			name: 'Hero fits within the mobile viewport',
			status: 'error',
			detail: 'mobile viewport measurement failed',
			cropReliable: false,
			durationMs: Date.now() - startedAt,
		});
	} finally {
		await page.setViewportSize(DESKTOP_VP).catch(() => {});
	}

	const durationMs = Date.now() - startedAt;
	logScanTiming('pattern_checks', durationMs, {
		...options.timing,
		pageUrl,
		scope,
		ok: true,
		failed: results.filter((r) => r.status === 'fail').length,
		cropsUnreliable: results.filter((r) => r.status === 'fail' && r.cropReliable === false).length,
	});

	return { pageUrl, results, durationMs };
}
