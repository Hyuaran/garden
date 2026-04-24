/**
 * Garden Root — KoT 同期履歴ログの型定義
 *
 * DB テーブル `public.root_kot_sync_log` に対応。
 * migration: supabase/migrations/20260425000001_root_kot_sync_log.sql
 */

/** 同期種別 */
export type KotSyncType = "masters" | "monthly_attendance" | "daily_attendance";

/** 同期ステータス */
export type KotSyncStatus = "running" | "success" | "partial" | "failure";

/** 同期履歴 1 行 */
export interface RootKotSyncLog {
  id: string;                        // uuid
  sync_type: KotSyncType;
  sync_target: string | null;        // '2026-04' / '2026-04-24' / 'all' など
  triggered_by: string;              // user_id (uuid 文字列) or 'cron'
  triggered_at: string;              // ISO timestamptz
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  status: KotSyncStatus;
  records_fetched: number;
  records_inserted: number;
  records_updated: number;
  records_skipped: number;
  error_code: string | null;
  error_message: string | null;
  error_stack: string | null;
  created_at: string;
  updated_at: string;
}

/** insertSyncLog の入力 */
export interface InsertSyncLogInput {
  sync_type: KotSyncType;
  /** 月 (YYYY-MM) / 日 (YYYY-MM-DD) / 'all' 等の同期対象識別子 */
  sync_target?: string | null;
  /** user_id または 'cron' */
  triggered_by: string;
  /** 省略時 'running'（処理開始を記録する用途） */
  status?: KotSyncStatus;
  records_fetched?: number;
  error_code?: string | null;
  error_message?: string | null;
  error_stack?: string | null;
}

/** updateSyncLogComplete の入力（成功 / 部分成功時） */
export interface UpdateSyncLogCompleteInput {
  status: "success" | "partial";
  records_fetched?: number;
  records_inserted?: number;
  records_updated?: number;
  records_skipped?: number;
}

/** updateSyncLogFailure の入力（失敗時） */
export interface UpdateSyncLogFailureInput {
  error_code: string;
  error_message: string;
  error_stack?: string | null;
  /** 失敗でも fetch 自体は成功している場合は件数を残す */
  records_fetched?: number;
}
