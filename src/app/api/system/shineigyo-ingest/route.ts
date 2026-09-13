import { NextResponse } from "next/server";

import { parseShineigyoIngestBody, ShineigyoIngestValidationError } from "@/app/system/_lib/shineigyo-ingest";
import { verifyBearerRequest } from "@/lib/cron-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const auth = verifyBearerRequest(request, "CALL_INGEST_SECRET");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: auth.status });

  let parsed: ReturnType<typeof parseShineigyoIngestBody>;
  try {
    parsed = parseShineigyoIngestBody(await request.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    const code = error instanceof ShineigyoIngestValidationError ? error.code : "INVALID_JSON";
    return NextResponse.json({ ok: false, error: message, error_code: code }, { status: 400 });
  }

  if (parsed.valid.length === 0) {
    return NextResponse.json({
      ok: false,
      status: "failure",
      records_fetched: parsed.fetched,
      records_upserted: 0,
      records_rejected: parsed.rejected.length,
      rejected: parsed.rejected,
    }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  try {
    const { error: upsertError } = await supabase
      .from("system_fm_shineigyo")
      .upsert(parsed.valid, { onConflict: "主キー", ignoreDuplicates: false });
    if (upsertError) throw new Error(`新営業upsert失敗: ${upsertError.message}`);

    const { data: existingLog, error: existingLogError } = await supabase
      .from("system_fm_shineigyo_sync_log")
      .select("total_rows")
      .eq("run_id", parsed.metadata.runId)
      .maybeSingle<{ total_rows: number }>();
    if (existingLogError) throw new Error(`新営業ログ確認失敗: ${existingLogError.message}`);

    const nextTotal = (existingLog?.total_rows ?? 0) + parsed.valid.length;
    const { error: logError } = await supabase
      .from("system_fm_shineigyo_sync_log")
      .upsert({
        run_id: parsed.metadata.runId,
        status: "running",
        total_rows: nextTotal,
        error_message: parsed.rejected.length > 0 ? "一部の行を検証で拒否しました" : null,
      }, { onConflict: "run_id", ignoreDuplicates: false });
    if (logError) throw new Error(`新営業ログ更新失敗: ${logError.message}`);

    const status = parsed.rejected.length > 0 ? "partial" : "success";
    return NextResponse.json({
      ok: status === "success",
      status,
      records_fetched: parsed.fetched,
      records_upserted: parsed.valid.length,
      records_rejected: parsed.rejected.length,
      rejected: parsed.rejected,
    }, { status: status === "partial" ? 207 : 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "新営業取込処理に失敗しました";
    console.error("[system/shineigyo-ingest] batch failed", message, { run_id: parsed.metadata.runId, batch_index: parsed.metadata.batchIndex });
    return NextResponse.json({ ok: false, status: "failure", error: "新営業取込処理に失敗しました" }, { status: 500 });
  }
}
