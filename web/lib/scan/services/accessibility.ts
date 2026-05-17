import AxeBuilder from '@axe-core/playwright';
import type { Page } from 'playwright-core';
import type { ScanResult } from '../types/scan.types';

export async function collectAxeViolations(
	page: Page,
): Promise<NonNullable<ScanResult['axe']>> {
	const results = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
		.analyze();

	return results.violations as NonNullable<ScanResult['axe']>;
}
