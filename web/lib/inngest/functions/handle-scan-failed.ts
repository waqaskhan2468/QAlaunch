import { internalEvents } from 'inngest';
import { inngest } from '@/lib/inngest/client';
import { getServiceSupabase } from '@/lib/db/supabase';
import type { ProcessPayload } from '@/lib/inngest/process.types';
import { failScan, toUserFacingScanError } from '@/lib/scan/fail-scan';

export const handleScanFailed = inngest.createFunction(
	{
		id: 'handle-scan-failed',
		name: 'Mark scan failed after pipeline exhaustion',
		triggers: [{ event: internalEvents.FunctionFailed }],
	},
	async ({ event }) => {
		const data = event.data as {
			function_id?: string;
			error?: { message?: string } | string;
			event?: { data?: ProcessPayload };
		};

		const functionId = data.function_id ?? '';
		if (!functionId.includes('run-scan')) {
			return;
		}

		const scanId = data.event?.data?.scanId;
		if (!scanId) {
			return;
		}

		const rawError = data.error;
		const error =
			typeof rawError === 'string' ? rawError
			: rawError?.message ? rawError.message
			: 'Scan failed after multiple attempts.';

		const supabase = getServiceSupabase();
		await failScan(supabase, scanId, toUserFacingScanError(error));
	},
);
