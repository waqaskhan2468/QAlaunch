import { Paddle } from "@paddle/paddle-node-sdk";

let paddleClient: Paddle | null = null;

function getPaddleClient(): Paddle {
  if (paddleClient) {
    return paddleClient;
  }

  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) {
    throw new Error("PADDLE_API_KEY is missing.");
  }

  paddleClient = new Paddle(apiKey);
  return paddleClient;
}

export async function verifyAndParsePaddleWebhook(body: string, signature: string) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!signature || !secret) return null;

  try {
    return await getPaddleClient().webhooks.unmarshal(body, secret, signature);
  } catch {
    return null;
  }
}
