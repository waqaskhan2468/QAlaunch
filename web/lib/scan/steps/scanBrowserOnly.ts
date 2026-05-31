import { NonRetriableError } from 'inngest';
import { ScanWriter } from '@/lib/artifacts/incremental';
import { formatErrorWithCause } from '@/lib/db/supabase-retry';
import { toUserFacingScanError } from '@/lib/scan/fail-scan';
import { runPlaywrightScanForUrl } from '@/lib/scan/services/index';
import {
	isBrowserNonRetriable,
	isBrowserRetriable,
} from '@/lib/scan/steps/scan-errors';
import type { PageBrowserStepResult } from '@/lib/artifacts/types';

function slog(event: string, fields: Record<string, unknown>): void {
	console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...fields }));
}

export async function scanBrowserOnlyStep(input: {
	scanId: string;
	pageUrl: string;
}): Promise<PageBrowserStepResult> {
	const writer = new ScanWriter(input.scanId, input.pageUrl);

	try {
		slog('scan:browser_start', { scanId: input.scanId, pageUrl: input.pageUrl });

		const result = await runPlaywrightScanForUrl(input.scanId, input.pageUrl, {
			writer,
		});

		slog('scan:browser_done', {
			scanId: input.scanId,
			pageUrl: input.pageUrl,
			ok: result.ok,
			steps: result.steps.length,
		});

		// Writes all scan data to DB in one shot — no Storage artifact JSON.
		return await writer.finalize(result);
	} catch (error: unknown) {
		slog('scan:browser_error', {
			scanId: input.scanId,
			pageUrl: input.pageUrl,
			error: formatErrorWithCause(error),
			retriable: isBrowserRetriable(error),
		});

		if (isBrowserRetriable(error)) {
			throw error;
		}

		if (isBrowserNonRetriable(error)) {
			throw new NonRetriableError(toUserFacingScanError(error));
		}

		throw error;
	}
}
