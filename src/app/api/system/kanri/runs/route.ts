import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireManager } from "@/app/system/mypage/_lib/submission-server";
import { createKanriRun } from "@/app/system/kanri/_lib/kanri-import.server";
import type { KanriMode } from "@/app/system/kanri/_lib/kanri-core";

export const runtime = "nodejs";
export const maxDuration = 120;

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(request: Request) {
  const manager = await requireManager();
  if (!manager) return NextResponse.json({ ok: false }, { status: 403 });
  const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get("limit") ?? 10), 1), 50);
  const { data, error } = await getSupabaseAdmin()
    .from("system_kanri_run")
    .select("id,target_date,mode,creator_name,status,summary,warnings,started_at,finished_at,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return NextResponse.json({ ok: false, error: "取り込み履歴を読み込めませんでした" }, { status: 500 });
  return NextResponse.json({ ok: true, runs: data ?? [] });
}

export async function POST(request: Request) {
  const manager = await requireManager();
  if (!manager) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await request.json().catch(() => null) as { targetDate?: unknown; mode?: unknown } | null;
  const targetDate = String(body?.targetDate ?? "");
  const mode = String(body?.mode ?? "daily") as KanriMode;
  if (!validDate(targetDate) || !["daily", "closing"].includes(mode)) {
    return NextResponse.json({ ok: false, error: "対象日と種類を確認してください" }, { status: 400 });
  }
  try {
    const result = await createKanriRun({
      targetDate,
      mode,
      userId: String(manager.userId),
      creatorName: String(manager.name),
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ ok: false, error: "取り込みを完了できませんでした" }, { status: 500 });
  }
}
