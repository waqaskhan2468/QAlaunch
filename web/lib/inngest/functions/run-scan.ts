import { inngest } from '@/lib/inngest/client';
import { SCAN_PROCESS_REQUESTED } from '@/lib/inngest/events';
import { callScannerStep } from '@/lib/scan/steps/callScanner';
import { collectPageSpeedStep } from '@/lib/scan/steps/collectPageSpeed';
import { detectAndSelectPagesStep } from '@/lib/scan/steps/detectAndSelectPages';
import { generatePdfStep } from '@/lib/scan/steps/generatePdf';
import { markCrawlingStep } from '@/lib/scan/steps/markCrawling';
import { markScanDoneStep } from '@/lib/scan/steps/markScanDone';
import { persistScanMetadataStep } from '@/lib/scan/steps/persistScanMetadata';
import { reloadScanStep } from '@/lib/scan/steps/reloadScan';
import { runAiAnalysisStep } from '@/lib/scan/steps/runAiAnalysisStep';
import { sendReportEmailStep } from '@/lib/scan/steps/sendReportEmail';
import type { ProcessPayload } from '@/types/api/process';

export const runScan = inngest.createFunction(
	{
		id: 'run-scan',
		name: 'Run scan pipeline',
		retries: 2,
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

		await Promise.all([
			step.run('collect-pagespeed', () =>
				collectPageSpeedStep(scanId, pagesToTest),
			),
			step.run('call-scanner', () =>
				callScannerStep({ scanId, pagesToTest }),
			),
		]);

		const scanAfter = await step.run('reload-scan', () =>
			reloadScanStep(scanId),
		);

		if (scanAfter?.status === 'failed') return;

		await step.run('ai-analysis', () =>
			runAiAnalysisStep({ scanId, pkg, scanAfter, pagesToTest }),
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
