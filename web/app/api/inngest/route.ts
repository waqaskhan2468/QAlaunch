import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { runScan } from '@/lib/inngest/functions/run-scan';

export const runtime = 'nodejs';

export const { GET, POST, PUT } = serve({
	client: inngest,
	functions: [runScan],
});
