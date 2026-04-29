import { Client, Receiver } from '@upstash/qstash';

const getClient = () =>
	new Client({
		token: process.env.QSTASH_TOKEN!,
		baseUrl: process.env.QSTASH_URL, 
	});

export async function queueScanJob(payload: {
	scanId: string;
	package: string;
	targetUrl: string;
	userEmail?: string | null;
}) {
	const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

	if (!appUrl) {
		throw new Error('NEXT_PUBLIC_APP_URL is not set');
	}

	await getClient().publishJSON({
		url: `${appUrl}/api/scan/process`,
		body: payload,
		retries: 3,
	});
}

export async function verifyQStashRequest(req: Request, body: string) {
	const receiver = new Receiver({
		currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
		nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
	});

	const signature = req.headers.get('upstash-signature') ?? '';
	return receiver.verify({
		signature,
		body,
		url: req.url,
	});
}
