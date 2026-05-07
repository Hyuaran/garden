"use server";

/**
 * Garden Root — KoT 同期ログの再実行 Server Action
 *
 * A-3-b 履歴ビューアから失敗/部分成功のログを選んで再実行する。
 * 元ログはそのまま残し、新しい sync_log 行を起票して対応する既存同期関数を呼ぶ。
 *
 * スコープ制約:
 *   - `sync_type='monthly_attendance'` のみ再実行対応（A-3-a で実装済）
 *   - `sync_type='daily_attendance'` は A-3-d 実装後に拡張
 *   - `sync_type='masters'` は将来対応
 *
 * 冪等性:
 *   - monthly_attendance は既存 upsert パターン（attendance_id を PK に）で冪等
 *   - 再実行しても重複行は作られず、imported_at のみ更新される
 */

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { previewKotMonthlySync } from "./kot-sync";
import type { RootKotSyncLog } from "../_types/kot-sync-log";

export type RerunResult =
  | { ok: true; new_log_id: string; message: string }
  | { ok: false; error_code: string; message: string };

/**
 * 指定した log_id の同期を再実行する。
 *
 * NOTE: 実際の upsert は client 側の既存経路（KotSyncModal）で行う前提のため、
 * A-3-b ここではあくまで preview を走らせて新しい log 行を起票するだけ。
 * UI 側では「再実行を依頼 → 対応する /root/attendance 画面の KoT 取込モーダル
 * を自動で開く」導線がユーザーフレンドリ。ただし本 spec では「新しい log が
 * 入る」ことが DoD なので、preview 呼出で start/failure 系は反映される。
 *
 * 将来拡張: 完全自動再実行（preview → server-side upsert）にする場合は
 * service_role で upsertAttendance 相当を server-side 実装する必要あり。
 */
export async function rerunSync(logId: string, triggeredBy?: string): Promise<RerunResult> {
  // 元ログを取得（service_role で RLS バイパス）
  const { data, error } = await getSupabaseAdmin()
    .from("root_kot_sync_log")
    .select("sync_type, sync_target")
    .eq("id", logId)
    .maybeSingle<Pick<RootKotSyncLog, "sync_type" | "sync_target">>();

  if (error || !data) {
    return {
      ok: false,
      error_code: "LOG_NOT_FOUND",
      message: `元ログが見つかりません（id=${logId}）: ${error?.message ?? "no row"}`,
    };
  }

  // sync_target が必須（月指定などが無い同期は現状非対応）
  if (!data.sync_target) {
    return {
      ok: false,
      error_code: "MISSING_TARGET",
      message: "元ログに sync_target が無いため再実行できません",
    };
  }

  switch (data.sync_type) {
    case "monthly_attendance": {
      // previewKotMonthlySync が内部で新しい log 行を起票する
      const result = await previewKotMonthlySync(data.sync_target, triggeredBy ?? "rerun");
      if (result.ok) {
        return {
          ok: true,
          new_log_id: result.log_id ?? "",
          message: `月次同期の再プレビュー成功（対象: ${data.sync_target}、${result.rows.length} 行）。/root/attendance で取込を完了してください。`,
        };
      }
      return {
        ok: false,
        error_code: result.error_code,
        message: `再プレビュー失敗: ${result.message}`,
      };
    }
    case "daily_attendance":
      return {
        ok: false,
        error_code: "NOT_IMPLEMENTED",
        message: "日次同期の再実行は A-3-d で実装予定",
      };
    case "masters":
      return {
        ok: false,
        error_code: "NOT_IMPLEMENTED",
        message: "マスタ同期の再実行は将来実装予定",
      };
    default:
      return {
        ok: false,
        error_code: "UNKNOWN_SYNC_TYPE",
        message: `未知の sync_type: ${data.sync_type}`,
      };
  }
}
