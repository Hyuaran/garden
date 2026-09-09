import { NextResponse } from "next/server";
import { requireManager } from "@/app/system/mypage/_lib/submission-server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { monthRange } from "@/app/system/kanri/_lib/kanri-core";
import { calculateKotDailyImport, readKotDailyCsv, type KotDailyHoursBasis } from "@/app/system/kanri/_lib/kot-daily";
import type { KanriManualInputs, KanriKotDailySummary } from "@/app/system/kanri/_lib/calc/kanri-sheet";
import type { KanriPerson } from "@/app/system/kanri/_lib/calc/jisseki-sheet";

export const runtime = "nodejs";

const LAYOUT_MESSAGE = "KOT のレイアウト『Garden管理表ポータル（日）』で出したファイルを選んでください";
const SELECT_PERSON_COLUMNS = "id,name,kot_name,team,department,employment_kind,base_wage,is_field_sales,active,sort_order";

function emptyInputs(): KanriManualInputs {
  return { hoursByTeamByDate: {}, openRateByTeamByProduct: {} };
}

function isHoursBasis(value: FormDataEntryValue | null): value is KotDailyHoursBasis {
  return value === "auto" || value === "plan" || value === "actual";
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return Boolean(value && typeof value === "object" && "arrayBuffer" in value);
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

  const runIds = (runResult.data ?? []).map((run) => run.id);
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

function mergeRunSummary(current: unknown, kot: KanriKotDailySummary) {
  const base = current && typeof current === "object" ? current as Record<string, unknown> : {};
  const entries = Object.entries(base).filter(([key]) => key !== "total" && key !== "kot_daily" && key !== "kotDaily");
  const total = entries.reduce((sum, [, value]) => {
    const count = value && typeof value === "object" && "count" in value ? Number((value as { count?: unknown }).count) : 0;
    return sum + (Number.isFinite(count) ? count : 0);
  }, kot.rowCount);
  return {
    ...base,
    kot_daily: { label: "勤怠（KOT）", count: kot.rowCount, unit: "行" },
    kotDaily: {
      startDate: kot.startDate,
      endDate: kot.endDate,
      peopleCount: kot.peopleCount,
      rowCount: kot.rowCount,
      teamDayCount: kot.teamDayCount,
      missingNameCount: kot.missingNames.length,
      overwrittenCellCount: kot.overwrittenCells.length,
      issueCounts: kot.issueCounts,
      hoursBasis: kot.hoursBasis,
    },
    total,
  };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const manager = await requireManager();
  if (!manager) return NextResponse.json({ ok: false }, { status: 403 });
  const { id } = await context.params;
  const { data, error } = await getSupabaseAdmin()
    .from("system_kanri_result")
    .select("grid,calculated_at")
    .eq("run_id", id)
    .eq("sheet", "inputs")
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: "勤怠を読み込めませんでした" }, { status: 500 });
  const inputs = (data?.grid ?? emptyInputs()) as KanriManualInputs;
  return NextResponse.json({ ok: true, kotDaily: inputs.kotDaily ?? null });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const manager = await requireManager();
  if (!manager) return NextResponse.json({ ok: false }, { status: 403 });
  const { id } = await context.params;
  const admin = getSupabaseAdmin();

  const { data: run, error: runError } = await admin
    .from("system_kanri_run")
    .select("id,target_date,summary")
    .eq("id", id)
    .maybeSingle();
  if (runError) return NextResponse.json({ ok: false, error: "勤怠を取り込めませんでした" }, { status: 500 });
  if (!run) return NextResponse.json({ ok: false, error: "取り込み結果が見つかりません" }, { status: 404 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, error: "ファイルを選んでください" }, { status: 400 });
  const file = form.get("file");
  if (!isUploadedFile(file)) return NextResponse.json({ ok: false, error: "ファイルを選んでください" }, { status: 400 });

  let rows;
  try {
    rows = readKotDailyCsv(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ ok: false, error: LAYOUT_MESSAGE }, { status: 400 });
  }

  const range = monthRange(String(run.target_date));
  const [inputResult, personResult] = await Promise.all([
    latestInputsForMonth(range.yearMonth),
    admin
      .from("system_kanri_person")
      .select(SELECT_PERSON_COLUMNS)
      .eq("active", true)
      .order("sort_order", { ascending: true }),
  ]);
  if (inputResult.error || personResult.error) {
    return NextResponse.json({ ok: false, error: "勤怠に必要な情報を読み込めませんでした" }, { status: 500 });
  }

  const currentInputs = (inputResult.data?.grid ?? emptyInputs()) as KanriManualInputs;
  const hoursBasis = isHoursBasis(form.get("hoursBasis")) ? form.get("hoursBasis") as KotDailyHoursBasis : undefined;
  const includeDispatchNames = String(form.get("includeDispatchNames") ?? "")
    .split(/[,\n]/)
    .map((value) => value.trim())
    .filter(Boolean);
  const result = calculateKotDailyImport({
    rows,
    people: (personResult.data ?? []) as KanriPerson[],
    currentInputs,
    hoursBasis,
    includeDispatchNames: includeDispatchNames.length ? includeDispatchNames : undefined,
    actualThroughDate: String(run.target_date),
  });

  const deleteResult = await admin
    .from("system_kanri_source_row")
    .delete()
    .eq("run_id", id)
    .eq("source", "kot_daily");
  if (deleteResult.error) return NextResponse.json({ ok: false, error: "勤怠を保存できませんでした" }, { status: 500 });

  if (result.sourceRows.length > 0) {
    const { error: rowError } = await admin.from("system_kanri_source_row").insert(
      result.sourceRows.map((row) => ({
        run_id: id,
        source: row.source,
        source_app: row.sourceApp,
        record_id: row.recordId,
        payload: row.payload,
      })),
    );
    if (rowError) return NextResponse.json({ ok: false, error: "勤怠を保存できませんでした" }, { status: 500 });
  }

  const { error: inputSaveError } = await admin
    .from("system_kanri_result")
    .upsert({
      run_id: id,
      sheet: "inputs",
      grid: result.inputs,
      calculated_at: new Date().toISOString(),
    }, { onConflict: "run_id,sheet" });
  if (inputSaveError) return NextResponse.json({ ok: false, error: "勤怠を保存できませんでした" }, { status: 500 });

  const summary = mergeRunSummary(run.summary, result.summary);
  const { error: runUpdateError } = await admin
    .from("system_kanri_run")
    .update({ summary, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (runUpdateError) return NextResponse.json({ ok: false, error: "勤怠の結果を保存できませんでした" }, { status: 500 });

  return NextResponse.json({ ok: true, inputs: result.inputs, kotDaily: result.inputs.kotDaily, summary });
}
