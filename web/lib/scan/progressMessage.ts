/**
 * Real-state progress messaging for the scan progress pages (free + paid).
 *
 * Every message is derived from actual pipeline state polled from
 * `GET /api/scan/status/{id}` — never from a fixed timer. The ONLY time-based
 * element is `rotateTick`, which cycles the cosmetic sub-labels *within* the
 * real `crawling` phase (the browser scan has no finer-grained backend status).
 * Phase transitions themselves only happen when `status` actually changes.
 */

export type ScanProgressStatus =
	| 'pending'
	| 'crawling'
	| 'analyzing'
	| 'done'
	| 'failed'
	| null;

export type ScanProgressInput = {
	status: ScanProgressStatus;
	/** Hostname of the site being scanned, for the "Loading …" message. */
	host: string | null;
	/** Number of pages selected/scanned so far (real — scan_pages row count). */
	pageCount: number | null;
	/** Issues found so far across analysed pages (real — from ai_analysis). */
	interimIssueCount: number | null;
	/** True once every scanned page has a finished ai_analysis. */
	allPagesAnalyzed: boolean;
	/** Paid only: report_pdf_url is present (PDF built, email sending). */
	hasReport: boolean;
	isPaid: boolean;
	/** Increments over time to rotate the crawl sub-labels (cosmetic only). */
	rotateTick: number;
};

/** Cosmetic sub-labels rotated during the real `crawling` phase. */
const CRAWL_ROTATION = [
	'Testing navigation and menus…',
	'Checking buttons and forms…',
	'Testing on mobile view…',
	'Checking for broken links…',
];

type AiAnalysisLike = { status?: string; issues?: unknown[] } | null | undefined;
type PageLike = { ai_analysis?: AiAnalysisLike };

/** Real interim issue count: sum of issues across pages with a successful analysis. */
export function countInterimIssues(pages: PageLike[] | null | undefined): number {
	if (!pages?.length) return 0;
	let total = 0;
	for (const page of pages) {
		const ai = page.ai_analysis;
		if (ai && ai.status === 'ok' && Array.isArray(ai.issues)) {
			total += ai.issues.length;
		}
	}
	return total;
}

/** True when every scanned page has a finished analysis (ok or failed). */
export function allPagesAnalyzed(pages: PageLike[] | null | undefined): boolean {
	if (!pages?.length) return false;
	return pages.every((page) => {
		const status = page.ai_analysis?.status;
		return status === 'ok' || status === 'failed';
	});
}

export function deriveScanProgressMessage(input: ScanProgressInput): string {
	const { status } = input;
	const site = input.host ?? 'your website';

	if (status === null || status === 'pending') {
		// Free scans run the reachability / login-gate check during `pending`
		// (the first pipeline step), before crawling begins.
		return `Checking ${site} is reachable…`;
	}

	if (status === 'crawling') {
		// Lead with the real page count once detection has populated it, then
		// rotate through the browser-scan sub-labels.
		const rotation: string[] = [];
		if (input.pageCount && input.pageCount > 0) {
			rotation.push(
				`Found ${input.pageCount} page${input.pageCount === 1 ? '' : 's'} to check`,
			);
		}
		rotation.push(...CRAWL_ROTATION);
		return rotation[input.rotateTick % rotation.length];
	}

	if (status === 'analyzing') {
		// Paid PDF/email window — both observable from real state: the scan stays
		// `analyzing` through AI → PDF → email, so once every page is analysed we
		// surface the report/email steps (report_pdf_url appears before mark-done).
		if (input.isPaid && input.allPagesAnalyzed) {
			return input.hasReport
				? 'Sending to your inbox…'
				: 'Putting together your report…';
		}
		if (input.interimIssueCount && input.interimIssueCount > 0) {
			const n = input.interimIssueCount;
			return `Found ${n} issue${n === 1 ? '' : 's'} so far, analysing in detail…`;
		}
		return 'Reviewing every page for issues…';
	}

	if (status === 'done') {
		return input.isPaid ? 'Sending to your inbox…' : 'Finishing up…';
	}

	return '';
}
