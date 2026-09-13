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

  // 件数の突き合わせは「受け取って検証を通った行数（記録の total_rows）」と DB の行数で行う。
  // 社内ホストPCが読んだ件数（parsed.total）との差は、検証で除外した行（主キーが空など）なので失敗にしない。
  // （2026-09-13 初回：読んだ 55,100 件のうち 4 件が検証で除外され、55,096 件が入ったのに count_mismatch で止まった）
  const { data: runLog, error: runLogError } = await supabase
    .from("system_fm_shineigyo_sync_log")
    .select("total_rows")
    .eq("run_id", parsed.runId)
    .maybeSingle<{ total_rows: number }>();
  if (runLogError) {
    console.error("[system/shineigyo-ingest/complete] log lookup failed", runLogError.message, { run_id: parsed.runId });
    return NextResponse.json({ ok: false, status: "failure", error: "新営業の取込記録を読めませんでした" }, { status: 500 });
  }
  const accepted = runLog?.total_rows ?? 0;
  const rejected = Math.max(0, parsed.total - accepted);
  if ((count ?? 0) !== accepted || accepted === 0) {
    await supabase
      .from("system_fm_shineigyo_sync_log")
      .upsert({
        run_id: parsed.runId,
        completed_at: completedAt,
        total_rows: count ?? 0,
        status: "count_mismatch",
        error_message: `受け取った ${accepted} 件に対して DB は ${count ?? 0} 件（読んだ件数 ${parsed.total}）`,
      }, { onConflict: "run_id", ignoreDuplicates: false });
    return NextResponse.json({ ok: false, status: "count_mismatch", total: parsed.total, accepted, actual: count ?? 0 }, { status: 409 });
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
      total_rows: accepted,
      status: "success",
      error_message: rejected > 0 ? `読んだ ${parsed.total} 件のうち ${rejected} 件は検証で除外（主キーが空など）` : null,
    }, { onConflict: "run_id", ignoreDuplicates: false });
  if (logError) {
    console.error("[system/shineigyo-ingest/complete] log failed", logError.message, { run_id: parsed.runId });
    return NextResponse.json({ ok: false, status: "failure", error: "新営業ログ更新に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: "success", total: parsed.total, accepted, rejected });
}
