/**
 * Garden Root — KoT 同期履歴ログ書込ヘルパ
 *
 * - テーブル: public.root_kot_sync_log
 * - 書込ルート: Server Action / Route Handler / Cron からのみ（service_role client 使用）
 * - 読取ルート: A-3-b UI で admin/super_admin が閲覧
 *
 * 書込失敗時は**メイン処理をブロックしない**（console.error のみ）。
 * 監査ログと同じ運用方針（既存 `_lib/audit.ts` と整合）。
 */

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  InsertSyncLogInput,
  RootKotSyncLog,
  UpdateSyncLogCompleteInput,
  UpdateSyncLogFailureInput,
} from "../_types/kot-sync-log";

/**
 * 同期開始ログを挿入。
 * 既定で `status='running'` として record を作成し、返された id を
 * 後続の updateSyncLogComplete / updateSyncLogFailure に渡して更新する。
 *
 * @returns 挿入成功時は `{ id }`、失敗時は `null`（メイン処理は続行すべき）
 */
export async function insertSyncLog(params: InsertSyncLogInput): Promise<{ id: string } | null> {
  try {
    const now = new Date().toISOString();
    const { data, error } = await getSupabaseAdmin()
      .from("root_kot_sync_log")
      .insert({
        sync_type: params.sync_type,
        sync_target: params.sync_target ?? null,
        triggered_by: params.triggered_by,
        triggered_at: now,
        started_at: now,
        status: params.status ?? "running",
        records_fetched: params.records_fetched ?? 0,
        error_code: params.error_code ?? null,
        error_message: params.error_message ?? null,
        error_stack: params.error_stack ?? null,
      })
      .select("id")
      .single<Pick<RootKotSyncLog, "id">>();
    if (error) {
      console.error("[kot-sync-log/insertSyncLog]", error.message, params);
      return null;
    }
    return { id: data.id };
  } catch (e) {
    console.error("[kot-sync-log/insertSyncLog] unexpected", e);
    return null;
  }
}

/**
 * 完了（成功 / 部分成功）として更新。
 * duration_ms は started_at と現在時刻から算出して自動で入れる。
 */
export async function updateSyncLogComplete(
  id: string,
  params: UpdateSyncLogCompleteInput,
): Promise<void> {
  try {
    const now = new Date();
    const { data: existing } = await getSupabaseAdmin()
      .from("root_kot_sync_log")
      .select("started_at")
      .eq("id", id)
      .single<Pick<RootKotSyncLog, "started_at">>();

    const startedAt = existing?.started_at ? new Date(existing.started_at) : null;
    const duration_ms = startedAt ? Math.max(0, now.getTime() - startedAt.getTime()) : null;

    const { error } = await getSupabaseAdmin()
      .from("root_kot_sync_log")
      .update({
        status: params.status,
        records_fetched: params.records_fetched ?? undefined,
        records_inserted: params.records_inserted ?? undefined,
        records_updated: params.records_updated ?? undefined,
        records_skipped: params.records_skipped ?? undefined,
        completed_at: now.toISOString(),
        duration_ms,
      })
      .eq("id", id);
    if (error) console.error("[kot-sync-log/updateSyncLogComplete]", error.message, { id, params });
  } catch (e) {
    console.error("[kot-sync-log/updateSyncLogComplete] unexpected", e);
  }
}

/**
 * 失敗として更新。
 * duration_ms / completed_at は insert と同じロジックで埋める。
 */
export async function updateSyncLogFailure(
  id: string,
  params: UpdateSyncLogFailureInput,
): Promise<void> {
  try {
    const now = new Date();
    const { data: existing } = await getSupabaseAdmin()
      .from("root_kot_sync_log")
      .select("started_at")
      .eq("id", id)
      .single<Pick<RootKotSyncLog, "started_at">>();

    const startedAt = existing?.started_at ? new Date(existing.started_at) : null;
    const duration_ms = startedAt ? Math.max(0, now.getTime() - startedAt.getTime()) : null;

    const { error } = await getSupabaseAdmin()
      .from("root_kot_sync_log")
      .update({
        status: "failure",
        error_code: params.error_code,
        error_message: params.error_message,
        error_stack: params.error_stack ?? null,
        records_fetched: params.records_fetched ?? undefined,
        completed_at: now.toISOString(),
        duration_ms,
      })
      .eq("id", id);
    if (error) console.error("[kot-sync-log/updateSyncLogFailure]", error.message, { id, params });
  } catch (e) {
    console.error("[kot-sync-log/updateSyncLogFailure] unexpected", e);
  }
}
