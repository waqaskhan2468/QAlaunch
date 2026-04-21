import { Client, Receiver } from "@upstash/qstash";

const getClient = () =>
	new Client({
		token: process.env.QSTASH_TOKEN!,
	});

export async function queueScanJob(payload: {
  scanId: string;
  package: string;
  targetUrl: string;
  userEmail?: string | null;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  


  if (process.env.NODE_ENV === 'development') {
		const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/scan/process`, {
			method: 'POST',
			body: JSON.stringify(payload),
			headers: { 'Content-Type': 'application/json' },
		});

		if (!response.ok) {
			throw new Error(`Failed to queue scan job: ${response.statusText}`);
		}

		return response.json();
	}



  // await getClient().publishJSON({
  //   url: `${appUrl}/api/scan/process`,
  //   body: payload
  // });
}

export async function verifyQStashRequest(req: Request, body: string) {
  const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!
  });

  const signature = req.headers.get("upstash-signature") ?? "";
  const url = req.url;
  return receiver.verify({
    signature,
    body,
    url
  });
}
