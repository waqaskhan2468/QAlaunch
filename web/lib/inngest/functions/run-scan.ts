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
import { scanPageStep } from '@/lib/scan/steps/scanPage';
import { sendReportEmailStep } from '@/lib/scan/steps/sendReportEmail';
import type { ProcessPayload } from '@/lib/inngest/process.types';

function getScanConcurrencyLimit(): number {
	const raw = Number.parseInt(process.env.INNGEST_SCAN_CONCURRENCY ?? '', 10);
	return Number.isFinite(raw) && raw > 0 ? raw : 5;
}

export const runScan = inngest.createFunction(
	{
		id: 'run-scan',
		name: 'Run scan pipeline',
		retries: 2,
		concurrency: {
			limit: getScanConcurrencyLimit(),
		},
		timeouts: {
			finish: '14m',
		},
		triggers: [{ event: SCAN_PROCESS_REQUESTED }],
	},
	async ({ event, step }) => {
		const { scanId, targetUrl, package: pkg } = event.data as ProcessPayload;

		await step.run('mark-crawling', () => markCrawlingStep(scanId));

		const { detection, pagesToTest, selectedPages } = await step.run(
			'detect-and-select-pages',
			() => detectAndSelectPagesStep(targetUrl, pkg),
		);

		await step.run('persist-metadata', () =>
			persistScanMetadataStep({
				scanId,
				detection,
				pagesToTest,
				selectedPages,
			}),
		);

		await step.run('prepare-scanner', () => prepareScannerStep(scanId));

		// PageSpeed and browser scan are independent; run in parallel to cut wall-clock time.
		await Promise.all([
			step.run('collect-pagespeed', () =>
				collectPageSpeedStep(scanId, pagesToTest, pkg),
			),
			...pagesToTest.map((pageUrl) =>
				step.run(`scan-page:${stepIdFromPageUrl(pageUrl)}`, () =>
					scanPageStep({ scanId, pageUrl }),
				),
			),
		]);

		const scannerStatus = await step.run('finalize-scanner', () =>
			finalizeScannerStep(scanId),
		);

		if (scannerStatus === 'failed') return;

		const scanAfter = await step.run('reload-scan', () => reloadScanStep(scanId));

		if (scanAfter?.status === 'failed') return;

		await step.run('clear-ai-issues', () => clearAiAnalysisStep(scanId));

		await Promise.all(
			pagesToTest.map((pageUrl) =>
				step.run(`ai-page:${stepIdFromPageUrl(pageUrl)}`, () =>
					analyzePageStep({
						scanId,
						pageUrl,
						websiteType: scanAfter?.website_type ?? detection.type ?? null,
						pkg,
					}),
				),
			),
		);

		await step.run('persist-ai-issues', () =>
			persistAiIssuesStep({ scanId, pkg, pagesToTest }),
		);

		const isFree = pkg === 'free';
		if (!isFree) {
			const report = await step.run('generate-pdf', () =>
				generatePdfStep(scanId),
			);

			await step.run('send-email', () =>
				sendReportEmailStep({ scanId, report }),
			);
		}

		await step.run('mark-done', () => markScanDoneStep({ scanId, pkg }));
	},
);
