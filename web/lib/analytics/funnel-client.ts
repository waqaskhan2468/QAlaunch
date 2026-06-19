import type { ClientFunnelEventType } from '@/lib/analytics/funnel';

/**
 * Fire-and-forget funnel event from the browser. Posts to /api/funnel, which
 * does the privileged insert server-side. `keepalive` lets the request survive
 * a navigation (e.g. the user clicking through to checkout right after).
 * Never throws — analytics must not interfere with the user flow.
 */
export function trackFunnelEvent(event: {
	scanId: string;
	eventType: ClientFunnelEventType;
	url: string;
	email?: string | null;
}): void {
	try {
		void fetch('/api/funnel', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(event),
			keepalive: true,
		}).catch(() => {});
	} catch {
		/* ignore — best-effort */
	}
}
