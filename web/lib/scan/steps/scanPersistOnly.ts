import { NonRetriableError } from 'inngest';
import type { PageBrowserStepResult } from '@/lib/artifacts/types';
import { toUserFacingScanError } from '@/lib/scan/fail-scan';
import { persistPageArtifactIndex } from '@/lib/scan/runner';
import {
	isPersistNonRetriable,
	isPersistRetriable,
} from '@/lib/scan/steps/scan-errors';

export async function scanPersistOnlyStep(input: {
	browserResult: PageBrowserStepResult;
}): Promise<{ ok: boolean }> {
	try {
		await persistPageArtifactIndex(input.browserResult);
		return { ok: input.browserResult.scanOk };
	} catch (error: unknown) {
		// Artifact is already in storage — retry DB index only; never fail whole scan yet.
		if (isPersistRetriable(error)) {
			throw error;
		}

		if (isPersistNonRetriable(error)) {
			throw new NonRetriableError(toUserFacingScanError(error));
		}

		throw error;
	}
}
