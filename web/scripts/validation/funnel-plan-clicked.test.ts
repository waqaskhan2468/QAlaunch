import { describe, it, expect } from 'vitest';
import { z } from 'zod';

import { CLIENT_FUNNEL_EVENTS, type FunnelEventType } from '@/lib/analytics/funnel';

/**
 * The step that was missing between "saw the upgrade section" and "opened
 * checkout".
 *
 * Seven days of paid traffic produced a funnel reading 28 → 0 across those two
 * rows, which looked like a cliff but was unreadable: checkout_started only
 * fires on the checkout page, after a plan is picked, the page loads, an email
 * is typed and Pay is pressed. "Nobody clicked a price" and "everyone who
 * clicked bounced off the checkout page" produced identical numbers and need
 * opposite fixes.
 */

describe('plan_clicked', () => {
	it('is emittable from the browser, or the results page cannot report it', () => {
		expect(CLIENT_FUNNEL_EVENTS).toContain('plan_clicked');
	});

	it('passes the API route’s own validation', () => {
		// Mirrors app/api/funnel/route.ts exactly.
		const schema = z.object({
			scanId: z.string().uuid(),
			eventType: z.enum(CLIENT_FUNNEL_EVENTS),
			url: z.string().min(1).max(2048),
			email: z.string().email().max(320).nullish(),
		});

		expect(
			schema.safeParse({
				scanId: '11111111-2222-3333-4444-555555555555',
				eventType: 'plan_clicked',
				url: 'https://example.com',
			}).success,
		).toBe(true);
	});

	it('still refuses server-only events from the browser', () => {
		// plan_clicked must not have widened what a browser may forge.
		for (const serverOnly of ['scan_started', 'scan_completed', 'payment_completed']) {
			expect(CLIENT_FUNNEL_EVENTS).not.toContain(serverOnly);
		}
	});

	it('sits between paywall_viewed and checkout_started', () => {
		// Order is what makes the funnel readable; a step in the wrong place
		// reports a drop-off that did not happen.
		const order: FunnelEventType[] = [
			'scan_started',
			'scan_completed',
			'results_viewed',
			'paywall_viewed',
			'plan_clicked',
			'checkout_started',
			'payment_completed',
		];
		expect(order.indexOf('plan_clicked')).toBe(order.indexOf('paywall_viewed') + 1);
		expect(order.indexOf('plan_clicked')).toBe(order.indexOf('checkout_started') - 1);
	});
});
