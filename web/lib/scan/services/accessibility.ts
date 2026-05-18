import AxeBuilder from '@axe-core/playwright';
import type { Page } from 'playwright-core';
import type { ScanResult } from '../types/scan.types';

export async function collectAxeViolations(
	page: Page,
): Promise<NonNullable<ScanResult['axe']>> {
	const results = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
		// Remote CDP (Browserbase): single-frame axe.run is more reliable than runPartial.
		.setLegacyMode(true)
		.analyze();

	return results.violations as NonNullable<ScanResult['axe']>;
}
