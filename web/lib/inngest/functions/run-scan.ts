import { inngest } from '@/lib/inngest/client';
import { SCAN_PROCESS_REQUESTED } from '@/lib/inngest/events';
import { stepIdFromPageUrl } from '@/lib/inngest/step-id';
import { analyzePageStep } from '@/lib/scan/steps/analyzePage';
import { clearAiAnalysisStep } from '@/lib/scan/steps/clearAiAnalysis';
import { collectPageSpeedStep } from '@/lib/scan/steps/collectPageSpeed';
import { detectAndSelectPagesStep } from '@/lib/scan/steps/detectAndSelectPages';
import { finalizeScannerStep } from '@/lib/scan/steps/finalizeScanner';
import { generatePdfStep } from '@/lib/scan/steps/generatePdf';
import { markCrawlingStep } from '@/lib/scan/steps/markCrawling';
import { markScanDoneStep } from '@/lib/scan/steps/markScanDone';
import { persistAiIssuesStep } from '@/lib/scan/steps/persistAiIssues';
import { persistScanMetadataStep } from '@/lib/scan/steps/persistScanMetadata';
import { prepareScannerStep } from '@/lib/scan/steps/prepareScanner';
import { reloadScanStep } from '@/lib/scan/steps/reloadScan';
import { scanBrowserOnlyStep } from '@/lib/scan/steps/scanBrowserOnly';
import { discoverAdditionalPagesStep } from '@/lib/scan/steps/discoverAdditionalPages';
import { persistFailedPageIndex } from '@/lib/scan/runner';
import { sendReportEmailStep } from '@/lib/scan/steps/sendReportEmail';
import type { ProcessPayload } from '@/lib/inngest/process.types';
import type { DetectAndSelectResult } from '@/lib/scan/steps/types';

function getScanConcurrencyLimit(): number {
	const raw = Number.parseInt(process.env.INNGEST_SCAN_CONCURRENCY ?? '', 10);
	return Number.isFinite(raw) && raw > 0 ? raw : 5;
}

/**
 * Main scan pipeline.
 *
 * Step execution order:
 *   1.  mark-crawling            — status → crawling
 *   2.  detect-and-select-pages  — homepage HTML → page list + website type
 *   3.  persist-metadata         — save detection result to DB
 *   4.  prepare-scanner          — pre-flight checks
 *   5a. collect-pagespeed        — Google PSI for all pages   ─┐ parallel
 *   5b. scan-browser:{url}        — Browserbase + Playwright → DB + screenshots ─┐
 *       scan-persist-failed:{url} — minimal DB stub when browser step fails       ─┘
 *   6.  finalize-scanner         — aggregate page statuses; early-exit if all failed
 *   7.  reload-scan              — re-fetch scan row for AI input
 *   8.  clear-ai-issues          — wipe stale AI results
 *   9.  ai-page:{url}            — Claude analysis per page (parallel)
 *   10. persist-ai-issues        — write issues to DB
 *   11. generate-pdf             — paid only
 *   12. send-email               — paid only
 *   13. mark-done                — status → done
 */
export const runScan = inngest.createFunction(
	{
		id: 'run-scan',
		name: 'Run scan pipeline',
		// One retry only. With SCAN_PAGE_TIMEOUT_MS=90s, retries:2 meant 3 attempts
		// = up to 270s on a stuck page before final failure. retries:1 cuts that
		// to ~180s while still giving one recovery shot for transient errors.
		retries: 1,
		concurrency: {
			limit: getScanConcurrencyLimit(),
		},
		timeouts: {
			// Inngest hard ceiling. With parallelism and the optimised Browserbase +
			// Claude timeouts, a typical 3-page paid scan should finish in 3–5 min.
			// 14 min gives generous headroom for slow target sites.
			finish: '14m',
		},
		triggers: [{ event: SCAN_PROCESS_REQUESTED }],
	},
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	async ({ event, step }: { event: any; step: any }) => {
		const { scanId, targetUrl, package: pkg } = event.data as ProcessPayload;

		// ── Phase 1: Discover pages ─────────────────────────────────────────
		await step.run('mark-crawling', () => markCrawlingStep(scanId));

		const { detection, pagesToTest, selectedPages } = (await step.run(
			'detect-and-select-pages',
			() => detectAndSelectPagesStep(targetUrl, pkg),
		)) as DetectAndSelectResult;

		await step.run('persist-metadata', () =>
			persistScanMetadataStep({
				scanId,
				detection,
				pagesToTest,
				selectedPages,
			}),
		);

		await step.run('prepare-scanner', () => prepareScannerStep(scanId));

		// ── Phase 2: Browser scans + PageSpeed (all parallel) ───────────────
		// Each scan-browser step creates its own Browserbase session so Inngest
		// retries never reuse a dead/stale shared session.
		const runPageScan = async (pageUrl: string) => {
			const slug = stepIdFromPageUrl(pageUrl);
			try {
				// scan-browser writes all scan data directly to the DB row — no separate persist step.
				await step.run(`scan-browser:${slug}`, () =>
					scanBrowserOnlyStep({ scanId, pageUrl }),
				);
			} catch {
				await step.run(`scan-persist-failed:${slug}`, () =>
					persistFailedPageIndex({ scanId, pageUrl }),
				);
			}
		};

		// Always scan the homepage first and in isolation so its playwright_data.links
		// is available for post-scan page discovery (needed when server-side HTML fetch
		// fails and only 1 page was selected despite a paid package).
		const homepageUrl = pagesToTest[0];
		const remainingFromDetect = pagesToTest.slice(1);

		await runPageScan(homepageUrl);

		// ── Post-scan page discovery ──────────────────────────────────────
		// For paid packages where detect-and-select-pages fell back to homepage-only
		// (server-side fetch failed, website_type = 'unknown'), read the links that
		// Playwright discovered on the homepage and queue additional page scans.
		let allPagesToScan = remainingFromDetect;

		if (remainingFromDetect.length === 0 && pkg !== 'free' && pkg !== 'basic') {
			const discovered = (await step.run('discover-additional-pages', () =>
				discoverAdditionalPagesStep({
					scanId,
					homepageUrl,
					alreadySelectedUrls: pagesToTest,
					pkg,
				}),
			)) as string[];

			if (discovered.length > 0) {
				// Persist the newly discovered pages as scan_pages rows so the AI
				// step and finalize step can see them.
				await step.run('persist-discovered-pages', async () => {
					const { getServiceSupabase } = await import('@/lib/db/supabase');
					const supabase = getServiceSupabase();
					await supabase.from('scan_pages').upsert(
						discovered.map((url: string) => ({
							scan_id: scanId,
							page_url: url,
							page_role: 'other',
						})),
						{ onConflict: 'scan_id,page_url' },
					);
					await supabase
						.from('scans')
						.update({ pages_to_test: [...pagesToTest, ...discovered] })
						.eq('id', scanId);
				});

				allPagesToScan = discovered;
			}
		}

		// Run remaining page scans + PageSpeed collection in parallel.
		await Promise.allSettled([
			step.run('collect-pagespeed', () =>
				collectPageSpeedStep(scanId, [homepageUrl, ...allPagesToScan], pkg),
			),
			...allPagesToScan.map((pageUrl) => runPageScan(pageUrl)),
		]);

		// ── Phase 3: Finalize browser phase ──────────────────────────────────
		const scannerStatus = await step.run('finalize-scanner', () =>
			finalizeScannerStep(scanId),
		);

		if (scannerStatus === 'failed') {
			console.error(
				JSON.stringify({
					ts: new Date().toISOString(),
					level: 'error',
					event: 'pipeline:early_exit',
					reason: 'all_pages_failed',
					scanId,
				}),
			);
			return;
		}

		const scanAfter = await step.run('reload-scan', () =>
			reloadScanStep(scanId),
		);

		if (scanAfter?.status === 'failed') {
			console.error(
				JSON.stringify({
					ts: new Date().toISOString(),
					level: 'error',
					event: 'pipeline:early_exit',
					reason: 'scan_status_failed_after_reload',
					scanId,
				}),
			);
			return;
		}

		// ── Phase 4: Claude AI analysis (all pages parallel) ─────────────────
		// allScannedPages includes both the original pagesToTest AND any pages
		// discovered post-scan (when server-side fetch failed for paid packages).
		const allScannedPages = [homepageUrl, ...allPagesToScan];

		await step.run('clear-ai-issues', () => clearAiAnalysisStep(scanId));

		await Promise.all(
			allScannedPages.map((pageUrl) =>
				step.run(`ai-page:${stepIdFromPageUrl(pageUrl)}`, () =>
					analyzePageStep({
						scanId,
						pageUrl,
						websiteType: detection.type ?? null,
						pkg,
					}),
				),
			),
		);

		await step.run('persist-ai-issues', () =>
			persistAiIssuesStep({ scanId, pkg, pagesToTest: allScannedPages }),
		);

		// ── Phase 5: Report + email (paid packages only) ──────────────────────
		if (pkg !== 'free') {
			const report = await step.run('generate-pdf', () =>
				generatePdfStep(scanId),
			);

			await step.run('send-email', () =>
				sendReportEmailStep({
					scanId,
					report: report ?? { pdfStoragePath: '', userEmail: null, targetUrl },
				}),
			);
		}

		await step.run('mark-done', () => markScanDoneStep({ scanId, pkg }));
	},
);
