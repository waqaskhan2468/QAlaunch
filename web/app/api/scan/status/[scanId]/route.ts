import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/db/supabase";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ scanId: string }> }) {
  const { scanId } = await params;
  const supabase = getServiceSupabase();

  const { data: scan, error: scanError } = await supabase.from("scans").select("*").eq("id", scanId).single();
  if (scanError || !scan) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: issues, error: issueError } = await supabase
    .from("issues")
    .select("*")
    .eq("scan_id", scanId)
    .order("severity", { ascending: false })
    .order("display_order", { ascending: true });

  if (issueError) {
    return NextResponse.json({ error: issueError.message }, { status: 500 });
  }

  const { data: pages } = await supabase.from("scan_pages").select("*").eq("scan_id", scanId);

  return NextResponse.json({
    scan,
    pages: pages ?? [],
    issues: issues ?? []
  });
}
