import { NextResponse } from "next/server";
import { normalizeUrl, urlHash, isPrivateUrl } from "@/lib/utils/url";
import { getServiceSupabase } from "@/lib/db/supabase";
import { queueScanJob } from "@/lib/api/qstash";
import { scanStartSchema } from "@/types/zod";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = scanStartSchema.safeParse(body);
  

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const normalized = normalizeUrl(parsed.data.url);


  if (isPrivateUrl(normalized)) {
    return NextResponse.json({ error: "private_url_not_allowed" }, { status: 400 });
  }

  const hash = urlHash(normalized);


  if (parsed.data.package === "free") {
    const { data: existing, error } = await supabase
      .from("scans")
      .select("id")
      .eq("url_hash", hash)
      .eq("package", "free")
      .eq("free_preview_used", true)
      .limit(1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (existing?.length) {
      return NextResponse.json({
        error: "free_preview_used",
        message: "This website has already been audited for free. Choose a package below to get the complete audit report.",
        showPricing: true
      }, { status: 409 });
    }
  }

  const { data: scan, error } = await supabase
    .from("scans")
    .insert({
      url: normalized,
      url_hash: hash,
      package: parsed.data.package,
      status: "pending",
      user_email: parsed.data.email ?? null,
      payment_status: parsed.data.package === "free" ? "free" : "pending",
      free_preview_used: false
    })
    .select("*")
    .single();

  if (error || !scan) {
    return NextResponse.json({ error: error?.message ?? "failed_to_create_scan" }, { status: 500 });
  }

  const job = await queueScanJob({
    scanId: scan.id,
    package: parsed.data.package,
    targetUrl: normalized,
    userEmail: parsed.data.email ?? null
  });
  console.log('[start] job', job);

  return NextResponse.json({
    scanId: scan.id,
    status: scan.status,
    message: "Scan queued successfully"
  });
}
