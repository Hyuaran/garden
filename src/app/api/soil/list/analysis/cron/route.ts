import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyBearerRequest } from "@/lib/cron-auth";

import { refreshAnalysis, type AnalysisDb } from "../_lib/analysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export async function GET(request: Request) {
  const auth = verifyBearerRequest(request, "CRON_SECRET");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: auth.status });

  try {
    const analysis = await refreshAnalysis(getSupabaseAdmin() as unknown as AnalysisDb);
    return NextResponse.json({ ok: true, analysis });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: errorMessage(error, "analysis_refresh_failed") },
      { status: 500 },
    );
  }
}
