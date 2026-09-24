import { NextResponse } from "next/server";

import { refreshAnalysis, refreshListOptions, type AnalysisDb } from "../_lib/analysis";

import { verifyBearerRequest } from "@/lib/cron-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const auth = verifyBearerRequest(request, "CRON_SECRET");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: auth.status });

  try {
    const analysis = await refreshAnalysis(getSupabaseAdmin() as unknown as AnalysisDb);
    const options = await refreshListOptions();
    return NextResponse.json({ ...analysis, ...options });
  } catch {
    return NextResponse.json({ ok: false, error: "分析集計を作り直せませんでした" }, { status: 500 });
  }
}
