import { NextResponse } from "next/server";
import { requireManager } from "@/app/system/mypage/_lib/submission-server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { monthRange } from "@/app/system/kanri/_lib/kanri-core";
import type { KanriManualInputs } from "@/app/system/kanri/_lib/calc/kanri-sheet";

export const runtime = "nodejs";

function validYearMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function emptyInputs(): KanriManualInputs {
  return { hoursByTeamByDate: {}, openRateByTeamByProduct: {} };
}

function validInputs(value: unknown): value is KanriManualInputs {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<KanriManualInputs>;
  return typeof input.hoursByTeamByDate === "object" && typeof input.openRateByTeamByProduct === "object";
}

async function latestRunForMonth(yearMonth: string) {
  const { start, end } = monthRange(`${yearMonth}-01`);
  return getSupabaseAdmin()
    .from("system_kanri_run")
    .select("id,target_date,finished_at,created_at")
    .gte("target_date", start)
    .lte("target_date", end)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

async function runsForMonth(yearMonth: string) {
  const { start, end } = monthRange(`${yearMonth}-01`);
  return getSupabaseAdmin()
    .from("system_kanri_run")
    .select("id,target_date,finished_at,created_at")
    .gte("target_date", start)
    .lte("target_date", end)
    .order("created_at", { ascending: false })
    .limit(50);
}

async function latestInputsForMonth(yearMonth: string) {
  const runResult = await runsForMonth(yearMonth);
  if (runResult.error) return { data: null, error: runResult.error };

  const runs = runResult.data ?? [];
  if (runs.length === 0) return { data: null, error: null };

  const inputResult = await getSupabaseAdmin()
    .from("system_kanri_result")
    .select("run_id,grid,calculated_at")
    .eq("sheet", "inputs")
    .in("run_id", runs.map((run) => run.id))
    .order("calculated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (inputResult.error) return { data: null, error: inputResult.error };

  const run = runs.find((item) => item.id === inputResult.data?.run_id) ?? null;
  return {
    data: inputResult.data ? { inputs: inputResult.data.grid as KanriManualInputs, run } : null,
    error: null,
  };
}

export async function GET(_request: Request, context: { params: Promise<{ yearMonth: string }> }) {
  const manager = await requireManager();
  if (!manager) return NextResponse.json({ ok: false }, { status: 403 });
  const { yearMonth } = await context.params;
  if (!validYearMonth(yearMonth)) return NextResponse.json({ ok: false }, { status: 400 });

  const inputResult = await latestInputsForMonth(yearMonth);
  if (inputResult.error) return NextResponse.json({ ok: false, error: "入力値を読み込めませんでした" }, { status: 500 });
  return NextResponse.json({
    ok: true,
    inputs: inputResult.data?.inputs ?? emptyInputs(),
    run: inputResult.data?.run ?? null,
  });
}

export async function PUT(request: Request, context: { params: Promise<{ yearMonth: string }> }) {
  const manager = await requireManager();
  if (!manager) return NextResponse.json({ ok: false }, { status: 403 });
  const { yearMonth } = await context.params;
  if (!validYearMonth(yearMonth)) return NextResponse.json({ ok: false }, { status: 400 });
  const body = await request.json().catch(() => null) as { inputs?: unknown } | null;
  if (!validInputs(body?.inputs)) return NextResponse.json({ ok: false, error: "入力値を確認してください" }, { status: 400 });

  const runResult = await latestRunForMonth(yearMonth);
  if (runResult.error) return NextResponse.json({ ok: false, error: "入力値を保存できませんでした" }, { status: 500 });
  if (!runResult.data) return NextResponse.json({ ok: false, error: "先にデータを取り込んでください" }, { status: 404 });

  const { data, error } = await getSupabaseAdmin()
    .from("system_kanri_result")
    .upsert({
      run_id: runResult.data.id,
      sheet: "inputs",
      grid: body.inputs,
      calculated_at: new Date().toISOString(),
    })
    .select("grid,calculated_at")
    .single();
  if (error) return NextResponse.json({ ok: false, error: "入力値を保存できませんでした" }, { status: 500 });
  return NextResponse.json({ ok: true, inputs: data.grid, run: runResult.data });
}
