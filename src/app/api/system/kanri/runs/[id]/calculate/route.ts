import { NextResponse } from "next/server";
import { requireManager } from "@/app/system/mypage/_lib/submission-server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { monthRange, type KanriSourceRow } from "@/app/system/kanri/_lib/kanri-core";
import { calculateKanriSheet, type KanriManualInputs, type KanriPointMaster, type KanriTeamMaster } from "@/app/system/kanri/_lib/calc/kanri-sheet";

export const runtime = "nodejs";

function emptyInputs(): KanriManualInputs {
  return { hoursByTeamByDate: {}, openRateByTeamByProduct: {} };
}

async function latestInputsForMonth(yearMonth: string) {
  const { start, end } = monthRange(`${yearMonth}-01`);
  const admin = getSupabaseAdmin();
  const runResult = await admin
    .from("system_kanri_run")
    .select("id,target_date,created_at")
    .gte("target_date", start)
    .lte("target_date", end)
    .order("created_at", { ascending: false })
    .limit(50);
  if (runResult.error) return { data: null, error: runResult.error };

  const runIds = (runResult.data ?? []).map((item) => item.id);
  if (runIds.length === 0) return { data: null, error: null };

  const inputResult = await admin
    .from("system_kanri_result")
    .select("grid,calculated_at")
    .eq("sheet", "inputs")
    .in("run_id", runIds)
    .order("calculated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return inputResult.error ? { data: null, error: inputResult.error } : { data: inputResult.data, error: null };
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const manager = await requireManager();
  if (!manager) return NextResponse.json({ ok: false }, { status: 403 });
  const { id } = await context.params;
  const admin = getSupabaseAdmin();

  const { data: run, error: runError } = await admin
    .from("system_kanri_run")
    .select("id,target_date")
    .eq("id", id)
    .maybeSingle();
  if (runError) return NextResponse.json({ ok: false, error: "計算できませんでした" }, { status: 500 });
  if (!run) return NextResponse.json({ ok: false, error: "取り込み結果が見つかりません" }, { status: 404 });

  const range = monthRange(String(run.target_date));
  const [sourceResult, settingResult, pointResult, teamResult, inputResult] = await Promise.all([
    admin
      .from("system_kanri_source_row")
      .select("source,source_app,record_id,payload")
      .eq("run_id", id),
    admin
      .from("system_kanri_month_setting")
      .select("holidays")
      .eq("year_month", range.yearMonth)
      .maybeSingle(),
    admin
      .from("system_kanri_point_master")
      .select("product,kintone_names,category,coefficient,unit_price,sort_order,active")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    admin
      .from("system_kanri_team")
      .select("team,sort_order,active")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    latestInputsForMonth(range.yearMonth),
  ]);

  if (sourceResult.error || settingResult.error || pointResult.error || teamResult.error || inputResult.error) {
    return NextResponse.json({ ok: false, error: "計算に必要な情報を読み込めませんでした" }, { status: 500 });
  }

  const grid = calculateKanriSheet({
    yearMonth: range.yearMonth,
    holidays: (settingResult.data?.holidays ?? []) as string[],
    sourceRows: (sourceResult.data ?? []).map((row) => ({
      source: row.source,
      sourceApp: row.source_app,
      recordId: row.record_id,
      payload: row.payload,
    })) as KanriSourceRow[],
    points: (pointResult.data ?? []) as KanriPointMaster[],
    teams: (teamResult.data ?? []) as KanriTeamMaster[],
    manualInputs: (inputResult.data?.grid ?? emptyInputs()) as KanriManualInputs,
  });

  const { error: saveError } = await admin
    .from("system_kanri_result")
    .upsert({
      run_id: id,
      sheet: "kanri",
      grid,
      calculated_at: new Date().toISOString(),
    });
  if (saveError) return NextResponse.json({ ok: false, error: "計算結果を保存できませんでした" }, { status: 500 });
  return NextResponse.json({ ok: true, grid });
}
