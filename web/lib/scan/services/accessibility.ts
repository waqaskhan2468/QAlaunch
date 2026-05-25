import AxeBuilder from '@axe-core/playwright';
import type { Page } from 'playwright-core';
import type { ScanResult } from '../types/scan.types';

const AXE_TIMEOUT_MS = 15_000;

export async function collectAxeViolations(
	page: Page,
): Promise<NonNullable<ScanResult['axe']>> {
	const axePromise = new AxeBuilder({ page })
		.include('body')
		.withTags(['wcag2a', 'wcag2aa'])
		// Remote CDP (Browserbase): single-frame axe.run is more reliable than runPartial.
		.setLegacyMode(true)
		.analyze();

	const timeoutPromise = new Promise<NonNullable<ScanResult['axe']>>(
		(_, reject) =>
			setTimeout(() => reject(new Error('axe_timeout')), AXE_TIMEOUT_MS),
	);

	const result = await Promise.race([axePromise, timeoutPromise]);
	return result.violations;
}
