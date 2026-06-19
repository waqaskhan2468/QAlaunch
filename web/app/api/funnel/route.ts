import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/db/supabase';
import { CLIENT_FUNNEL_EVENTS, logFunnelEvent } from '@/lib/analytics/funnel';

export const runtime = 'nodejs';

// Only the client-originated funnel steps are accepted here. Server-side events
// (scan_started / scan_completed / payment_completed) are written directly by
// their own code paths and must not be forgeable from the browser.
const funnelEventSchema = z.object({
	scanId: z.string().uuid(),
	eventType: z.enum(CLIENT_FUNNEL_EVENTS),
	url: z.string().min(1).max(2048),
	email: z.string().email().max(320).nullish(),
});

export async function POST(req: Request) {
	const json = await req.json().catch(() => null);
	const parsed = funnelEventSchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json({ ok: false, error: 'invalid_event' }, { status: 400 });
	}

	await logFunnelEvent(getServiceSupabase(), parsed.data);
	return NextResponse.json({ ok: true });
}
