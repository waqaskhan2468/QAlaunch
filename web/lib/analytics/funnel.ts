import type { ServiceSupabase } from '@/lib/db/supabase';

/**
 * Steps in the free-scan → payment funnel. See supabase/funnel_events.sql.
 *
 * plan_clicked sits between paywall_viewed and checkout_started because
 * without it those two are not adjacent. checkout_started only fires on the
 * checkout page, after someone has picked a plan, arrived, typed an email and
 * pressed Pay. For a week the funnel read "28 saw the upgrade section, 0
 * opened checkout" with no way to tell whether nobody clicked a price or
 * everybody who did bounced off the checkout page — two problems needing
 * opposite fixes.
 */
export type FunnelEventType =
	| 'scan_started'
	| 'scan_completed'
	| 'results_viewed'
	| 'paywall_viewed'
	| 'plan_clicked'
	| 'checkout_started'
	| 'payment_completed';

/** Client may only emit these — server-side events can't be spoofed via the API. */
export const CLIENT_FUNNEL_EVENTS = [
	'results_viewed',
	'paywall_viewed',
	'plan_clicked',
	'checkout_started',
] as const;

export type ClientFunnelEventType = (typeof CLIENT_FUNNEL_EVENTS)[number];

export type FunnelEventInput = {
	scanId: string;
	eventType: FunnelEventType;
	url: string;
	email?: string | null;
};

/**
 * Insert one funnel_events row. Analytics is best-effort: a failure here must
 * never break a scan, a webhook, or a checkout, so errors are logged and
 * swallowed rather than thrown.
 */
export async function logFunnelEvent(
	supabase: ServiceSupabase,
	event: FunnelEventInput,
): Promise<void> {
	try {
		const { error } = await supabase.from('funnel_events').insert({
			scan_id: event.scanId,
			event_type: event.eventType,
			email: event.email ?? null,
			url: event.url,
		});
		if (error) {
			console.error('[funnel] insert failed', {
				eventType: event.eventType,
				scanId: event.scanId,
				error: error.message,
			});
		}
	} catch (err) {
		console.error('[funnel] insert threw', {
			eventType: event.eventType,
			scanId: event.scanId,
			error: err instanceof Error ? err.message : String(err),
		});
	}
}
