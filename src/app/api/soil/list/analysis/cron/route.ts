import { NextResponse } from "next/server";

import { refreshAnalysis, refreshListOptions, type AnalysisDb } from "../_lib/analysis";

import { verifyBearerRequest } from "@/lib/cron-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export async function GET(request: Request) {
  const auth = verifyBearerRequest(request, "CRON_SECRET");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: auth.status });

  let analysis:
    | ({ ok: true } & Awaited<ReturnType<typeof refreshAnalysis>>)
    | { ok: false; error: string };

  try {
    const result = await refreshAnalysis(getSupabaseAdmin() as unknown as AnalysisDb);
    analysis = { ...result, ok: true };
  } catch (error) {
    analysis = { ok: false, error: errorMessage(error, "分析集計を作り直せませんでした") };
  }

  const options = await refreshListOptions().catch((error) => ({
    optionsRefreshed: false,
    optionsRefreshError: errorMessage(error, "選択肢の件数を更新できませんでした"),
  }));
  const ok = analysis.ok && !options.optionsRefreshError;
  return NextResponse.json(
    {
      ok,
      analysis,
      ...options,
    },
    { status: ok ? 200 : 500 },
  );
}
