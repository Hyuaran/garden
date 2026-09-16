import { NextResponse } from "next/server";

import { requireSoilListUser } from "../_lib/auth";
import { isAnalysisAxis, loadAnalysisPayload, loadFilteredAnalysis, type AnalysisDb } from "./_lib/analysis";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireSoilListUser();
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const axis = url.searchParams.get("axis");
    const vendors = url.searchParams.getAll("vendor");
    const lineTypes = url.searchParams.getAll("lineType");
    const contractYears = url.searchParams.getAll("contractYear");
    if (vendors.length > 0 || lineTypes.length > 0 || contractYears.length > 0) {
      if (!isAnalysisAxis(axis)) {
        return NextResponse.json({ ok: false, error: "切り口が不正です" }, { status: 400 });
      }
      const block = await loadFilteredAnalysis({ vendors, lineTypes, contractYears, axis });
      return NextResponse.json({ ok: true, block });
    }

    const analysis = await loadAnalysisPayload(getSupabaseAdmin() as unknown as AnalysisDb);
    return NextResponse.json({ ok: true, analysis });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "分析を読み込めませんでした" }, { status: 500 });
  }
}
