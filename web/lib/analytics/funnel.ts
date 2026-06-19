import type { ServiceSupabase } from '@/lib/db/supabase';

/** Steps in the free-scan → payment funnel. See supabase/funnel_events.sql. */
export type FunnelEventType =
	| 'scan_started'
	| 'scan_completed'
	| 'results_viewed'
	| 'paywall_viewed'
	| 'checkout_started'
	| 'payment_completed';

/** Client may only emit these — server-side events can't be spoofed via the API. */
export const CLIENT_FUNNEL_EVENTS = [
	'results_viewed',
	'paywall_viewed',
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
