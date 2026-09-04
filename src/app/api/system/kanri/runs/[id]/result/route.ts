import { NextResponse } from "next/server";
import { requireManager } from "@/app/system/mypage/_lib/submission-server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const manager = await requireManager();
  if (!manager) return NextResponse.json({ ok: false }, { status: 403 });
  const { id } = await context.params;
  const sheet = new URL(request.url).searchParams.get("sheet") ?? "kanri";
  const { data, error } = await getSupabaseAdmin()
    .from("system_kanri_result")
    .select("run_id,sheet,grid,calculated_at")
    .eq("run_id", id)
    .eq("sheet", sheet)
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: "計算結果を読み込めませんでした" }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, error: "計算結果が見つかりません" }, { status: 404 });
  return NextResponse.json({ ok: true, result: data });
}
