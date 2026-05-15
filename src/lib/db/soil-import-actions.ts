/**
 * Garden-Soil Phase B-01: Server Actions（import job status transitions）
 *
 * 対応 spec:
 *   - docs/specs/2026-04-26-soil-phase-b-01-list-import-phase-1.md（B-01 §4.3 状態遷移）
 *
 * 作成: 2026-05-08（Phase B-01 第 3 弾、a-soil）
 *
 * 状態遷移:
 *   queued → running → (paused | failed | completed | cancelled)
 *                ↓                ↑
 *              resume ←———————————┘
 *
 * 役割:
 *   admin が UI から発火する Server Actions（start / pause / resume / retry / cancel）
 *   + orchestrator が完了/失敗時に呼ぶ marker（markCompleted / markFailed）。
 *
 * 設計方針:
 *   - すべて純粋に soil_list_imports の UPDATE のみ（副作用は status 更新と日時セット）
 *   - retry は staging / normalized / errors を削除（spec §4.3）
 *   - throw せず { ok, error? } を返却
 *   - admin 操作は §4.4 で監査ログ予定（次セッション以降）
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// 型定義
// ============================================================

export type ImportActionInput = {
  supabase: SupabaseClient;
  importJobId: string;
};

export type ImportActionResult = {
  ok: boolean;
  error?: string;
};

// ============================================================
// 内部ヘルパー: soil_list_imports UPDATE のラッパー
// ============================================================

async function updateImportJob(
  supabase: SupabaseClient,
  importJobId: string,
  payload: Record<string, unknown>,
): Promise<ImportActionResult> {
  const result = (await supabase
    .from("soil_list_imports")
    .update(payload)
    .eq("id", importJobId)) as { error: { message: string } | null };

  if (result.error) {
    return { ok: false, error: result.error.message };
  }
  return { ok: true };
}

// ============================================================
// Public Actions
// ============================================================

/** start: queued → running、started_at セット */
export async function startImportJob(
  input: ImportActionInput,
): Promise<ImportActionResult> {
  return updateImportJob(input.supabase, input.importJobId, {
    job_status: "running",
    started_at: new Date().toISOString(),
  });
}

/** pause: running → paused */
export async function pauseImportJob(
  input: ImportActionInput,
): Promise<ImportActionResult> {
  return updateImportJob(input.supabase, input.importJobId, {
    job_status: "paused",
  });
}

/** resume: paused → running（最後に成功した chunk_id 以降を再取得、orchestrator 側で処理） */
export async function resumeImportJob(
  input: ImportActionInput,
): Promise<ImportActionResult> {
  return updateImportJob(input.supabase, input.importJobId, {
    job_status: "running",
  });
}

/** retry: failed → running、staging / normalized / errors を truncate */
export async function retryImportJob(
  input: ImportActionInput,
): Promise<ImportActionResult> {
  const { supabase, importJobId } = input;

  // staging / normalized / errors を job 単位で削除
  await supabase.from("soil_imports_staging").delete().eq("import_job_id", importJobId);
  await supabase.from("soil_imports_normalized").delete().eq("import_job_id", importJobId);
  await supabase.from("soil_imports_errors").delete().eq("import_job_id", importJobId);

  return updateImportJob(supabase, importJobId, {
    job_status: "running",
    chunks_completed: 0,
    failed_count: 0,
    error_summary: null,
    started_at: new Date().toISOString(),
    completed_at: null,
  });
}

/** cancel: running → cancelled、completed_at セット（staging データは保持、admin 判断で truncate） */
export async function cancelImportJob(
  input: ImportActionInput,
): Promise<ImportActionResult> {
  return updateImportJob(input.supabase, input.importJobId, {
    job_status: "cancelled",
    completed_at: new Date().toISOString(),
  });
}

/** orchestrator が呼ぶ: 失敗時 mark */
export async function markImportJobFailed(input: {
  supabase: SupabaseClient;
  importJobId: string;
  errorMessage: string;
}): Promise<ImportActionResult> {
  return updateImportJob(input.supabase, input.importJobId, {
    job_status: "failed",
    completed_at: new Date().toISOString(),
    error_summary: { error_message: input.errorMessage },
  });
}

/** orchestrator が呼ぶ: 完走時 mark */
export async function markImportJobCompleted(
  input: ImportActionInput,
): Promise<ImportActionResult> {
  return updateImportJob(input.supabase, input.importJobId, {
    job_status: "completed",
    completed_at: new Date().toISOString(),
  });
}
