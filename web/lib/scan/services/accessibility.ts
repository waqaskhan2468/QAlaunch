import AxeBuilder from '@axe-core/playwright';
import type { Page } from 'playwright-core';
import type { AxeViolation, ScanResult } from '../types/scan.types';

// 15 s safety net. legacyMode forces a single axe.run() CDP call instead of
// many runPartial() round-trips. On Browserbase remote CDP each round-trip adds
// ~100–200 ms latency, so one blocking call is faster than 20–100 smaller ones.
// 15 s is enough for 99 % of pages with legacyMode; complex DOMs that need more
// time contribute little incremental value vs the 5 s saved on Phase 1 wall time.
const AXE_TIMEOUT_MS = 15_000;

function normalizeAxeTarget(target: (string | string[])[]): string[] {
	return target.map((selector) =>
		typeof selector === 'string' ? selector : selector.join(' >> '),
	);
}

export async function collectAxeViolations(
	page: Page,
): Promise<NonNullable<ScanResult['axe']>> {
	const axePromise = new AxeBuilder({ page })
		.include('body')
		.setLegacyMode(true)
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
		.options({ resultTypes: ['violations'] })
		.exclude('iframe[src*="youtube.com"]')
		.exclude('iframe[src*="vimeo.com"]')
		.exclude('iframe[src*="google.com/maps"]')
		.exclude('iframe[src*="doubleclick.net"]')
		.exclude('iframe[src*="facebook.com"]')
		.exclude('iframe[src*="twitter.com"]')
		.exclude('iframe[src*="instagram.com"]')
		.exclude('iframe[src*="linkedin.com"]')
		.analyze();

	// Prevent unhandled rejection if the timeout fires first.
	axePromise.catch(() => undefined);

	let timer: ReturnType<typeof setTimeout> | undefined;

	const timeoutPromise = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new Error('axe_timeout')), AXE_TIMEOUT_MS);
	});

	try {
		const result = await Promise.race([axePromise, timeoutPromise]);
		return result.violations.map(
			(v): AxeViolation => ({
				id: v.id,
				impact: v.impact ?? null,
				description: v.description,
				help: v.help,
				helpUrl: v.helpUrl,
				nodes: v.nodes.map((node) => ({
					html: node.html,
					target: normalizeAxeTarget(node.target),
					...(node.failureSummary
						? { failureSummary: node.failureSummary }
						: {}),
				})),
			}),
		);
	} finally {
		clearTimeout(timer);
	}
}
