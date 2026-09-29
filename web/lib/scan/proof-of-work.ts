/**
 * Turns the raw playwright_data a scan already stores into a short, factual
 * account of what the scanner actually DID.
 *
 * Why this exists: a paying visitor told us "the free version only shows 3
 * issues and there are many other tools like this." They were right about what
 * the page showed. QAlaunch opens the site in a real cloud browser, renders it
 * at multiple widths, follows every link, clicks buttons, submits forms and
 * reviews real screenshots — and the result page displayed none of that. It
 * showed three findings and a paywall, which is exactly what a static SEO
 * checker looks like.
 *
 * Findings alone cannot carry the difference, because every checker produces
 * findings. The work is the difference, so the work has to be visible.
 *
 * Every number here is read from data the browser already receives; nothing new
 * is collected and the scan pipeline is untouched. Anything missing is simply
 * omitted rather than guessed, so the panel never claims work that didn't run.
 */

export type ProofStat = {
	/** The number, pre-formatted. */
	value: string;
	/** What it counts, in the visitor's language. */
	label: string;
	/** Optional qualifier shown under the label. */
	detail?: string;
};

export type ProofOfWork = {
	stats: ProofStat[];
	/** Viewport widths the page was actually rendered at, e.g. [390, 1280]. */
	viewportWidths: number[];
	/** True when at least one real screenshot exists to show. */
	hasScreenshots: boolean;
};

type Unknown = Record<string, unknown>;

const asRecord = (v: unknown): Unknown | null =>
	v && typeof v === 'object' && !Array.isArray(v) ? (v as Unknown) : null;

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function asCount(v: unknown): number | null {
	return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
}

/** "1" / "12" / "1,204" — never a bare 0, which reads as "nothing happened". */
function fmt(n: number): string {
	return n.toLocaleString('en-US');
}

export function buildProofOfWork(input: {
	playwrightData: unknown;
	hasDesktopScreenshot: boolean;
	hasMobileScreenshot: boolean;
}): ProofOfWork {
	const pw = asRecord(input.playwrightData);
	const stats: ProofStat[] = [];

	// ── Viewport widths actually rendered ──────────────────────────────────
	const responsive = asArray(pw?.responsive);
	const viewportWidths = responsive
		.map((r) => asCount(asRecord(r)?.width))
		.filter((w): w is number => w !== null);

	// ── Links followed ─────────────────────────────────────────────────────
	const links = asRecord(pw?.links);
	const checked = asCount(links?.checkedLinks) ?? asCount(links?.totalLinks);
	if (checked && checked > 0) {
		const broken = asArray(links?.brokenLinks).length;
		stats.push({
			value: fmt(checked),
			label: checked === 1 ? 'link followed' : 'links followed',
			detail: broken > 0 ? `${fmt(broken)} broken` : 'all reachable',
		});
	}

	// ── Buttons and forms actually exercised ───────────────────────────────
	const tests = asRecord(pw?.interactionTests);
	const testsRun = asCount(tests?.testsRun);
	if (testsRun && testsRun > 0) {
		const failed = asCount(tests?.testsFailed) ?? 0;
		stats.push({
			value: fmt(testsRun),
			label: testsRun === 1 ? 'interaction tested' : 'interactions tested',
			detail: failed > 0 ? `${fmt(failed)} failed` : 'buttons, forms, links',
		});
	}

	// ── Screen widths ──────────────────────────────────────────────────────
	if (viewportWidths.length > 0) {
		const min = Math.min(...viewportWidths);
		const max = Math.max(...viewportWidths);
		stats.push({
			value: fmt(viewportWidths.length),
			label: viewportWidths.length === 1 ? 'screen width' : 'screen widths',
			// A single viewport must not render as "390-390px".
			detail: min === max ? `${min}px` : `${min}–${max}px`,
		});
	}

	// ── Accessibility rules ────────────────────────────────────────────────
	const axe = asArray(pw?.axeViolations);
	if (axe.length > 0) {
		stats.push({
			value: fmt(axe.length),
			label: axe.length === 1 ? 'accessibility rule broken' : 'accessibility rules broken',
			detail: 'axe-core, the standard used in the industry',
		});
	}

	// ── Errors the browser itself reported ─────────────────────────────────
	const consoleErrors = asArray(pw?.consoleMessages).filter((m) => {
		const t = asRecord(m)?.type;
		return typeof t === 'string' && /error|severe/i.test(t);
	}).length;
	const failedRequests = asArray(pw?.failedRequests).length;
	const browserErrors = consoleErrors + failedRequests;
	if (browserErrors > 0) {
		stats.push({
			value: fmt(browserErrors),
			label: browserErrors === 1 ? 'browser error caught' : 'browser errors caught',
			detail: 'only visible with the page actually running',
		});
	}

	return {
		stats,
		viewportWidths,
		hasScreenshots: input.hasDesktopScreenshot || input.hasMobileScreenshot,
	};
}
