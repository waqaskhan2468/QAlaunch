import crypto from "crypto";

export async function verifyPaddleWebhook(body: string, signature: string) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET!;
  if (!signature || !secret) return false;

  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
