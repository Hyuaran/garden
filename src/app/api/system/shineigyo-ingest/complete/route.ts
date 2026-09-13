import { NextResponse } from "next/server";

import { parseShineigyoCompleteBody, ShineigyoIngestValidationError } from "@/app/system/_lib/shineigyo-ingest";
import { verifyBearerRequest } from "@/lib/cron-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const auth = verifyBearerRequest(request, "CALL_INGEST_SECRET");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: auth.status });

  let parsed: ReturnType<typeof parseShineigyoCompleteBody>;
  try {
    parsed = parseShineigyoCompleteBody(await request.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    const code = error instanceof ShineigyoIngestValidationError ? error.code : "INVALID_JSON";
    return NextResponse.json({ ok: false, error: message, error_code: code }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const completedAt = new Date().toISOString();
  const { count, error: countError } = await supabase
    .from("system_fm_shineigyo")
    .select("主キー", { count: "exact", head: true })
    .eq("run_id", parsed.runId);
  if (countError) {
    console.error("[system/shineigyo-ingest/complete] count failed", countError.message, { run_id: parsed.runId });
    return NextResponse.json({ ok: false, status: "failure", error: "新営業件数確認に失敗しました" }, { status: 500 });
  }

  if ((count ?? 0) !== parsed.total) {
    await supabase
      .from("system_fm_shineigyo_sync_log")
      .upsert({
        run_id: parsed.runId,
        completed_at: completedAt,
        total_rows: count ?? 0,
        status: "count_mismatch",
        error_message: `expected ${parsed.total}, got ${count ?? 0}`,
      }, { onConflict: "run_id", ignoreDuplicates: false });
    return NextResponse.json({ ok: false, status: "count_mismatch", total: parsed.total, actual: count ?? 0 }, { status: 409 });
  }

  const { error: deleteError } = await supabase
    .from("system_fm_shineigyo")
    .delete()
    .neq("run_id", parsed.runId);
  if (deleteError) {
    console.error("[system/shineigyo-ingest/complete] delete stale rows failed", deleteError.message, { run_id: parsed.runId });
    return NextResponse.json({ ok: false, status: "failure", error: "新営業の古い行を削除できませんでした" }, { status: 500 });
  }

  const { error: logError } = await supabase
    .from("system_fm_shineigyo_sync_log")
    .upsert({
      run_id: parsed.runId,
      completed_at: completedAt,
      total_rows: parsed.total,
      status: "success",
      error_message: null,
    }, { onConflict: "run_id", ignoreDuplicates: false });
  if (logError) {
    console.error("[system/shineigyo-ingest/complete] log failed", logError.message, { run_id: parsed.runId });
    return NextResponse.json({ ok: false, status: "failure", error: "新営業ログ更新に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: "success", total: parsed.total });
}
