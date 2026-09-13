import { NextResponse } from "next/server";

import { requireSoilListUser } from "../_lib/auth";
import { loadAnalysisPayload, type AnalysisDb } from "./_lib/analysis";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSoilListUser();
  if (!auth.ok) return auth.response;

  try {
    const analysis = await loadAnalysisPayload(getSupabaseAdmin() as unknown as AnalysisDb);
    return NextResponse.json({ ok: true, analysis });
  } catch {
    return NextResponse.json({ ok: false, error: "分析を読み込めませんでした" }, { status: 500 });
  }
}
