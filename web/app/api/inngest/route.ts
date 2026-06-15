import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import {
	getInngestServeOrigin,
	logInngestProductionMisconfigWarnings,
} from '@/lib/inngest/config';
import { handleScanFailed } from '@/lib/inngest/functions/handle-scan-failed';
import { runScan } from '@/lib/inngest/functions/run-scan';

export const runtime = 'nodejs';

// serve() and the misconfig warnings run at module load. Without this, Next's
// build-time page-data collection imports the module and trips Inngest's setup
// ("markAsUncloneable is not a function"). Force dynamic so this route is only
// ever evaluated at runtime, never pre-rendered.
export const dynamic = 'force-dynamic';

/** Per-step ceiling (seconds). Premium = up to 10 pages × ~150s — needs Pro/Enterprise + Fluid Compute. */
export const maxDuration = 300;

logInngestProductionMisconfigWarnings();

const serveOrigin = getInngestServeOrigin();

export const { GET, POST, PUT } = serve({
	client: inngest,
	functions: [runScan, handleScanFailed],
	servePath: '/api/inngest',
	...(serveOrigin ? { serveOrigin } : {}),
});
