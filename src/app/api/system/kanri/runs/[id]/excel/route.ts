import { NextResponse } from "next/server";

import { requireManager } from "@/app/system/mypage/_lib/submission-server";
import { kanriExcelFilename, writeKanriWorkbookBuffer, type KanriExcelResults } from "@/app/system/kanri/_lib/export/excel-export";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { KanriPointMaster } from "@/app/system/kanri/_lib/calc/kanri-sheet";

export const runtime = "nodejs";

const RESULT_SHEETS = ["kanri", "jisseki", "aporan", "houhan", "incentive", "payroll"] as const;

type ResultSheet = typeof RESULT_SHEETS[number];
type RunRow = { id: string; target_date: string };
type ResultRow = { sheet: ResultSheet; grid: unknown };

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const manager = await requireManager();
  if (!manager) return NextResponse.json({ ok: false }, { status: 403 });
  const { id } = await context.params;
  const admin = getSupabaseAdmin();

  const [runResult, resultRows, pointResult] = await Promise.all([
    admin
      .from("system_kanri_run")
      .select("id,target_date")
      .eq("id", id)
      .maybeSingle(),
    admin
      .from("system_kanri_result")
      .select("sheet,grid")
      .eq("run_id", id)
      .in("sheet", [...RESULT_SHEETS]),
    admin
      .from("system_kanri_point_master")
      .select("product,kintone_names,category,coefficient,unit_price,sort_order,active")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
  ]);

  if (runResult.error || resultRows.error || pointResult.error) {
    return NextResponse.json({ ok: false, error: "Excel を作成できませんでした" }, { status: 500 });
  }
  if (!runResult.data) {
    return NextResponse.json({ ok: false, error: "取り込み結果が見つかりません" }, { status: 404 });
  }

  const rows = ((resultRows.data ?? []) as ResultRow[]).filter((row) => RESULT_SHEETS.includes(row.sheet));
  const resultBySheet = new Map<ResultSheet, unknown>(rows.map((row) => [row.sheet, row.grid]));
  const missing = RESULT_SHEETS.filter((sheet) => !resultBySheet.has(sheet));
  if (missing.length > 0) {
    return NextResponse.json({ ok: false, error: "先に「計算する」を押してください" }, { status: 409 });
  }

  const run = runResult.data as RunRow;
  const filename = kanriExcelFilename(String(run.target_date));
  const asciiFilename = `kanri-report-${String(run.target_date).replaceAll("-", "")}.xlsx`;
  const buffer = await writeKanriWorkbookBuffer({
    run,
    results: Object.fromEntries(RESULT_SHEETS.map((sheet) => [sheet, resultBySheet.get(sheet)])) as KanriExcelResults,
    points: (pointResult.data ?? []) as KanriPointMaster[],
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
