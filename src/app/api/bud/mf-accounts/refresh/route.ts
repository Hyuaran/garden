import { NextResponse } from "next/server";
import { mfAccess } from "@/lib/bud/mf/access";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { syncMf } from "@/lib/bud/mf/sync";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST() {
  const auth = await mfAccess();
  if (!auth.ok) return NextResponse.json({ error: "読み直す権限がありません" }, { status: auth.status });
  if (!auth.admin) {
    const visible = await auth.db.from("bud_mf_accounts").select("mf_account_id").limit(1);
    if (visible.error || !visible.data?.length) return NextResponse.json({ error: "読み直す権限がありません" }, { status: 403 });
  }
  try {
    const result = await syncMf(getSupabaseAdmin(), "button");
    return NextResponse.json(result, { status: result.ok ? 200 : result.busy ? 429 : 502 });
  } catch { return NextResponse.json({ error: "読み込みを開始できませんでした" }, { status: 500 }); }
}
