import { NextResponse } from "next/server";
import { verifyPaddleWebhook } from "@/lib/api/paddle";
import { getServiceSupabase } from "@/lib/db/supabase";
import { queueScanJob } from "@/lib/api/qstash";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("paddle-signature") ?? "";

  if (!(await verifyPaddleWebhook(body, signature))) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(body);
  const supabase = getServiceSupabase();

  if (event.event_type === "transaction.completed") {
    const { scanId, package: pkg, targetUrl, userEmail } = event.data.custom_data ?? {};
    if (!scanId || !targetUrl || !pkg) {
      return NextResponse.json({ error: "missing_custom_data" }, { status: 400 });
    }

    await supabase.from("scans").update({
      package: pkg,
      payment_id: event.data.id,
      payment_status: "paid",
      status: "pending"
    }).eq("id", scanId);

    await queueScanJob({
      scanId,
      package: pkg,
      targetUrl,
      userEmail: userEmail ?? null
    });
  }

  return NextResponse.json({ ok: true });
}
