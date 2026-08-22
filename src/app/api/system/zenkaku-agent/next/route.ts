import { NextResponse } from "next/server";
import { verifyBearerRequest } from "@/lib/cron-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = verifyBearerRequest(request, "ZENKAKU_AGENT_SECRET");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: auth.status });
  const { data, error } = await getSupabaseAdmin().rpc("system_zenkaku_claim_next");
  if (error) { console.error("[zenkaku-agent] claim failed"); return NextResponse.json({ ok: false, error: "claim_failed" }, { status: 500 }); }
  const item = Array.isArray(data) ? data[0] : null;
  return NextResponse.json({ ok: true, request: item ? { id: item.id, salesId: item.sales_id } : null });
}
