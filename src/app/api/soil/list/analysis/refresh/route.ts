import { systemViewResponse } from "@/lib/auth/view-permission.server";
import { NextResponse } from "next/server";

import { requireSoilListUser } from "../../_lib/auth";
import { refreshAnalysis, type AnalysisDb } from "../_lib/analysis";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  for (const scopeTab of ["analysis"]) {
    const viewDenied = await systemViewResponse("system-list", scopeTab, true);
    if (viewDenied) return viewDenied;
  }

  const auth = await requireSoilListUser();
  if (!auth.ok) return auth.response;

  try {
    const result = await refreshAnalysis(getSupabaseAdmin() as unknown as AnalysisDb);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { ok: false, error: "集計を作り直せませんでした（途中で止まりました）。もう一度押してください" },
      { status: 500 },
    );
  }
}
