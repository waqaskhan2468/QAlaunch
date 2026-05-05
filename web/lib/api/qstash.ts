
import { Client } from '@upstash/workflow';

export async function queueScanJob(payload: {
	scanId: string;
	package: string;
	targetUrl: string;
	userEmail?: string | null;
}) {
	const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
	if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL is not set');

	const client = new Client({ token: process.env.QSTASH_TOKEN! });

	await client.trigger({
		url: `${appUrl}/api/scan/process`,
		body: payload,
		retries: 2,
	});
}
