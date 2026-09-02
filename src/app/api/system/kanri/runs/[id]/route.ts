import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireManager } from "@/app/system/mypage/_lib/submission-server";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const manager = await requireManager();
  if (!manager) return NextResponse.json({ ok: false }, { status: 403 });
  const { id } = await context.params;
  const { data, error } = await getSupabaseAdmin()
    .from("system_kanri_run")
    .select("id,target_date,mode,creator_name,status,summary,warnings,started_at,finished_at,created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: "取り込み結果を読み込めませんでした" }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, error: "取り込み結果が見つかりません" }, { status: 404 });
  return NextResponse.json({ ok: true, run: data });
}
