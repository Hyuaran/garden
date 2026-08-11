import { NextResponse } from "next/server";

import { parseCallIngestBody, CallIngestValidationError } from "@/app/system/_lib/call-ingest";
import { verifyBearerRequest } from "@/lib/cron-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const auth = verifyBearerRequest(request, "CALL_INGEST_SECRET");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: auth.status });

  let parsed: ReturnType<typeof parseCallIngestBody>;
  try {
    parsed = parseCallIngestBody(await request.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    const code = error instanceof CallIngestValidationError ? error.code : "INVALID_JSON";
    return NextResponse.json({ ok: false, error: message, error_code: code }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const startedAt = new Date();
  const { data: log, error: logError } = await supabase.from("system_call_sync_log").insert({
    run_id: parsed.metadata.runId,
    batch_index: parsed.metadata.batchIndex,
    source: "callcenter-fm-agent",
    range_from: parsed.metadata.rangeFrom,
    range_to: parsed.metadata.rangeTo,
    status: "running",
    started_at: startedAt.toISOString(),
    records_fetched: parsed.fetched,
    records_rejected: parsed.rejected.length,
  }).select("id").single<{ id: string }>();
  if (logError || !log) {
    console.error("[system/call-ingest] sync log start failed", logError?.message ?? "missing log id");
    return NextResponse.json({ ok: false, error: "同期ログを開始できません" }, { status: 500 });
  }

  const finishLog = async (values: Record<string, unknown>) => {
    const completedAt = new Date();
    const { error } = await supabase.from("system_call_sync_log").update({
      ...values,
      completed_at: completedAt.toISOString(),
      duration_ms: Math.max(0, completedAt.getTime() - startedAt.getTime()),
    }).eq("id", log.id);
    if (error) console.error("[system/call-ingest] sync log finish failed", error.message);
  };

  if (parsed.valid.length === 0) {
    await finishLog({ status: "failure", error_code: "ALL_ROWS_REJECTED", error_message: "全行が入力検証で拒否されました" });
    return NextResponse.json({
      ok: false, status: "failure", log_id: log.id, records_fetched: parsed.fetched,
      records_inserted: 0, records_updated: 0, records_rejected: parsed.rejected.length,
      rejected: parsed.rejected,
    }, { status: 400 });
  }

  try {
    const ids = parsed.valid.map((row) => row.external_call_id);
    const { data: existing, error: existingError } = await supabase
      .from("system_call_history").select("external_call_id").in("external_call_id", ids);
    if (existingError) throw new Error(`既存レコード確認失敗: ${existingError.message}`);
    const existingIds = new Set((existing ?? []).map((row) => String(row.external_call_id)));
    const recordsUpdated = parsed.valid.filter((row) => existingIds.has(row.external_call_id)).length;
    const recordsInserted = parsed.valid.length - recordsUpdated;
    const { error: upsertError } = await supabase.from("system_call_history")
      .upsert(parsed.valid, { onConflict: "external_call_id" });
    if (upsertError) throw new Error(`コール履歴upsert失敗: ${upsertError.message}`);

    const status = parsed.rejected.length > 0 ? "partial" : "success";
    await finishLog({ status, records_inserted: recordsInserted, records_updated: recordsUpdated });
    return NextResponse.json({
      ok: status === "success", status, log_id: log.id, records_fetched: parsed.fetched,
      records_inserted: recordsInserted, records_updated: recordsUpdated,
      records_rejected: parsed.rejected.length, rejected: parsed.rejected,
    }, { status: status === "partial" ? 207 : 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "取込処理に失敗しました";
    await finishLog({ status: "failure", error_code: "INGEST_FAILED", error_message: message });
    console.error("[system/call-ingest] batch failed", message, { run_id: parsed.metadata.runId, batch_index: parsed.metadata.batchIndex });
    return NextResponse.json({ ok: false, status: "failure", log_id: log.id, error: "取込処理に失敗しました" }, { status: 500 });
  }
}
