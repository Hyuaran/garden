import { NextResponse } from "next/server";
import { requireManager } from "@/app/system/mypage/_lib/submission-server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { monthRange, type KanriSourceRow } from "@/app/system/kanri/_lib/kanri-core";
import { calculateKanriSheet, type KanriManualInputs, type KanriPointMaster, type KanriTeamMaster } from "@/app/system/kanri/_lib/calc/kanri-sheet";
import { calculateJissekiSheet, normalizeCommuteMap, type KanriPerson } from "@/app/system/kanri/_lib/calc/jisseki-sheet";
import { calculateHouhanSheet } from "@/app/system/kanri/_lib/calc/houhan-sheet";

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
  const [sourceResult, settingResult, pointResult, teamResult, inputResult, personResult, employeeResult] = await Promise.all([
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
    admin
      .from("system_kanri_person")
      .select("id,name,kot_name,team,department,employment_kind,base_wage,is_field_sales,active,sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    admin
      .from("root_employees")
      .select("name,commute_daily_allowance")
      .eq("is_active", true)
      .is("deleted_at", null),
  ]);

  if (sourceResult.error || settingResult.error || pointResult.error || teamResult.error || inputResult.error || personResult.error || employeeResult.error) {
    return NextResponse.json({ ok: false, error: "計算に必要な情報を読み込めませんでした" }, { status: 500 });
  }
  const sourceRows = (sourceResult.data ?? []).map((row) => ({
    source: row.source,
    sourceApp: row.source_app,
    recordId: row.record_id,
    payload: row.payload,
  })) as KanriSourceRow[];
  const points = (pointResult.data ?? []) as KanriPointMaster[];
  const manualInputs = (inputResult.data?.grid ?? emptyInputs()) as KanriManualInputs;

  const grid = calculateKanriSheet({
    yearMonth: range.yearMonth,
    holidays: (settingResult.data?.holidays ?? []) as string[],
    sourceRows,
    points,
    teams: (teamResult.data ?? []) as KanriTeamMaster[],
    manualInputs,
  });
  const houhan = calculateHouhanSheet({
    yearMonth: range.yearMonth,
    sourceRows,
    people: (personResult.data ?? []) as KanriPerson[],
    manualInputs,
  });
  const jisseki = calculateJissekiSheet({
    yearMonth: range.yearMonth,
    sourceRows,
    points,
    people: (personResult.data ?? []) as KanriPerson[],
    manualInputs,
    commuteByName: normalizeCommuteMap((employeeResult.data ?? []) as { name: string | null; commute_daily_allowance: number | string | null }[]),
    houhan,
  });

  const { error: saveError } = await admin
    .from("system_kanri_result")
    .upsert([
      { run_id: id, sheet: "kanri", grid, calculated_at: new Date().toISOString() },
      { run_id: id, sheet: "houhan", grid: houhan, calculated_at: new Date().toISOString() },
      { run_id: id, sheet: "jisseki", grid: jisseki, calculated_at: new Date().toISOString() },
    ]);
  if (saveError) return NextResponse.json({ ok: false, error: "計算結果を保存できませんでした" }, { status: 500 });
  return NextResponse.json({ ok: true, grid, houhan, jisseki });
}
