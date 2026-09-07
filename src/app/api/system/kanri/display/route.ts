import { NextResponse } from "next/server";
import { requireStaff } from "@/app/system/mypage/_lib/submission-server";
import { tokyoToday } from "@/app/system/kanri/_lib/kanri-core";
import { buildKanriDisplayPayload } from "@/app/system/kanri/_lib/kanri-display";
import type { AporanSheetGrid } from "@/app/system/kanri/_lib/calc/aporan-sheet";
import type { KanriSheetGrid } from "@/app/system/kanri/_lib/calc/kanri-sheet";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type KanriResultRecord = {
  run_id: string;
  sheet: string;
  grid: unknown;
  calculated_at: string | null;
};

type KanriRunRecord = {
  id: string;
  target_date: string;
  created_at: string;
};

function isAporanGrid(value: unknown): value is AporanSheetGrid {
  return Boolean(value && typeof value === "object" && "targetDate" in value && "teams" in value);
}

function isKanriGrid(value: unknown): value is KanriSheetGrid {
  return Boolean(value && typeof value === "object" && "days" in value);
}

async function latestRun(targetDate?: string) {
  let query = getSupabaseAdmin()
    .from("system_kanri_run")
    .select("id,target_date,created_at");
  if (targetDate) query = query.eq("target_date", targetDate);
  return query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

async function resultForRun(runId: string, sheet: "aporan" | "kanri") {
  return getSupabaseAdmin()
    .from("system_kanri_result")
    .select("run_id,sheet,grid,calculated_at")
    .eq("run_id", runId)
    .eq("sheet", sheet)
    .maybeSingle();
}

async function kanriResultForRun(runId: string) {
  return getSupabaseAdmin()
    .from("system_kanri_result")
    .select("grid")
    .eq("run_id", runId)
    .eq("sheet", "kanri")
    .maybeSingle();
}

export async function GET() {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ ok: false }, { status: 403 });

  const today = tokyoToday();
  const todayRun = await latestRun(today);
  if (todayRun.error) return NextResponse.json({ ok: false, error: "表示する成績を読み込めませんでした" }, { status: 500 });

  const fallbackRun = todayRun.data ? null : await latestRun();
  if (fallbackRun?.error) return NextResponse.json({ ok: false, error: "表示する成績を読み込めませんでした" }, { status: 500 });
  const run = (todayRun.data ?? fallbackRun?.data ?? null) as KanriRunRecord | null;
  if (!run) return NextResponse.json({ ok: true, empty: true, message: "まだ計算していません" });

  const aporanRead = await resultForRun(run.id, "aporan");
  if (aporanRead.error) return NextResponse.json({ ok: false, error: "表示する成績を読み込めませんでした" }, { status: 500 });
  const aporanResult = aporanRead.data as KanriResultRecord | null;
  if (!aporanResult) return NextResponse.json({ ok: true, empty: true, message: "まだ計算していません" });
  if (!isAporanGrid(aporanResult.grid)) return NextResponse.json({ ok: true, empty: true, message: "まだ計算していません" });

  const kanriResult = await kanriResultForRun(aporanResult.run_id);
  if (kanriResult.error) return NextResponse.json({ ok: false, error: "表示する成績を読み込めませんでした" }, { status: 500 });

  const payload = buildKanriDisplayPayload({
    aporanGrid: aporanResult.grid,
    kanriGrid: isKanriGrid(kanriResult.data?.grid) ? kanriResult.data.grid : null,
    calculatedAt: aporanResult.calculated_at,
  });
  return NextResponse.json(payload);
}
