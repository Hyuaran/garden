import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { syncMf } from "@/lib/bud/mf/sync";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: Request) {
  const auth = verifyCronRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status });
  try {
    const result = await syncMf(getSupabaseAdmin(), "cron", { snapshot: true });
    return NextResponse.json(result, { status: result.ok ? 200 : result.busy ? 429 : 502 });
  } catch { return NextResponse.json({ error: "読み込みを開始できませんでした" }, { status: 500 }); }
}
