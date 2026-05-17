import { inngest } from '@/lib/inngest/client';
import { SCAN_PROCESS_REQUESTED } from '@/lib/inngest/events';
import type { ProcessPayload } from '@/lib/inngest/process.types';

export async function queueScanJob(payload: ProcessPayload) {
	await inngest.send({
		name: SCAN_PROCESS_REQUESTED,
		data: payload,
	});
}
