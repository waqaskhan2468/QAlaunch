import { NextResponse, after } from "next/server";
import { verifyAndParsePaddleWebhook } from "@/lib/api/paddle";
import { getServiceSupabase } from "@/lib/db/supabase";
import { queueScanJob } from "@/lib/api/queue-scan-job";
import { scanPackageSchema } from "@/types/zod";
import { logFunnelEvent } from "@/lib/analytics/funnel";
import { sendPaidScanAlert } from "@/lib/notifications/internal-alert";

export const runtime = "nodejs";

const PAID_TRANSACTION_EVENTS = new Set([
	'transaction.paid',
	'transaction.completed',
]);

function isPaidTransaction(eventType: string | undefined, status: string | undefined): boolean {
	if (!eventType || !PAID_TRANSACTION_EVENTS.has(eventType)) return false;
	return status === 'paid' || status === 'completed';
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("paddle-signature") ?? "";
  const parsedEvent = await verifyAndParsePaddleWebhook(body, signature);
  if (!parsedEvent) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const eventType = (parsedEvent as { eventType?: string; event_type?: string }).eventType ??
    (parsedEvent as { eventType?: string; event_type?: string }).event_type;
  const eventData = (parsedEvent as {
    data?: {
      id?: string;
      status?: string;
      currencyCode?: string;
      currency_code?: string;
      details?: {
        totals?: { grandTotal?: string; grand_total?: string; currencyCode?: string; currency_code?: string };
      };
      customData?: {
        scanId?: string;
        package?: string;
        targetUrl?: string;
        userEmail?: string;
      };
      custom_data?: {
        scanId?: string;
        package?: string;
        targetUrl?: string;
        userEmail?: string;
      };
    };
  }).data;

  const supabase = getServiceSupabase();

  if (!isPaidTransaction(eventType, eventData?.status)) {
    return NextResponse.json({ ok: true, ignored: true, eventType });
  }

  if (!eventData?.id) {
    return NextResponse.json({ error: "invalid_transaction_data" }, { status: 400 });
  }

  const transactionId = eventData.id;
  const { scanId, package: rawPackage, targetUrl, userEmail } =
    eventData.customData ?? eventData.custom_data ?? {};
  const packageResult = scanPackageSchema.safeParse(rawPackage);
  if (!scanId || !targetUrl || !packageResult.success || packageResult.data === "free") {
    return NextResponse.json({ error: "missing_or_invalid_custom_data" }, { status: 400 });
  }

  const pkg = packageResult.data;

  const { data: existingScan, error: scanFetchError } = await supabase
    .from("scans")
    .select("id, package, payment_id, payment_status")
    .eq("id", scanId)
    .single();

  if (scanFetchError || !existingScan) {
    console.error("[paddle webhook] scan lookup failed", { scanId, transactionId, scanFetchError });
    return NextResponse.json({ error: "scan_not_found" }, { status: 404 });
  }

  // Idempotency for retried webhook deliveries of the same transaction.
  if (existingScan.payment_id === transactionId) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  // Never accept a different transaction for a scan that is already paid.
  if (existingScan.payment_id && existingScan.payment_id !== transactionId) {
    console.error("[paddle webhook] conflicting transaction id", {
      scanId,
      existingPaymentId: existingScan.payment_id,
      incomingPaymentId: transactionId,
    });
    return NextResponse.json({ error: "payment_id_conflict" }, { status: 409 });
  }

  // Guard against package tampering by requiring webhook package to match scan package.
  if (existingScan.package !== pkg) {
    console.error("[paddle webhook] package mismatch", {
      scanId,
      expectedPackage: existingScan.package,
      incomingPackage: pkg,
    });
    return NextResponse.json({ error: "package_mismatch" }, { status: 409 });
  }

  const { error: updateError } = await supabase
    .from("scans")
    .update({
      payment_id: transactionId,
      payment_status: "paid",
      status: "pending",
      error_message: null,
    })
    .eq("id", scanId);

  if (updateError) {
    console.error("[paddle webhook] scan update failed", { scanId, transactionId, updateError });
    return NextResponse.json({ error: "scan_update_failed" }, { status: 500 });
  }

  // Funnel: payment confirmed for this scan (transaction.paid/completed).
  await logFunnelEvent(supabase, {
    scanId,
    eventType: "payment_completed",
    url: targetUrl,
    email: userEmail ?? null,
  });

  // Internal sale alert. Scheduled here — before the queue step — because the
  // payment is already confirmed and persisted at this point, so the sale is
  // worth knowing about even if queueing then fails (arguably more so: that
  // case needs manual follow-up). `after` runs it once the response is sent, so
  // a slow or failing email can never delay the webhook ack and trigger a
  // Paddle retry. Paddle reports totals in minor units ("2400" = $24.00).
  const totals = eventData.details?.totals;
  const rawTotal = totals?.grandTotal ?? totals?.grand_total;
  const currency =
    totals?.currencyCode ??
    totals?.currency_code ??
    eventData.currencyCode ??
    eventData.currency_code;
  const amount =
    rawTotal && Number.isFinite(Number(rawTotal)) ?
      `${(Number(rawTotal) / 100).toFixed(2)}${currency ? ` ${currency}` : ""}`
    : null;

  after(async () => {
    await sendPaidScanAlert({
      scanId,
      targetUrl,
      userEmail: userEmail ?? null,
      pkg,
      transactionId,
      amount,
    });
  });

  try {
    await queueScanJob({
      scanId,
      package: pkg,
      targetUrl,
      userEmail: userEmail ?? null,
    });
  } catch (error) {
    console.error("[paddle webhook] queue publish failed", { scanId, transactionId, error });
    return NextResponse.json({ error: "queue_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
