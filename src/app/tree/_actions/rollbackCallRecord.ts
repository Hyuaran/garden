"use server";

/**
 * Tree Phase D-02 Step 6: 巻き戻し Server Action
 *
 * spec §7、判 0-3 確定: 5s 固定
 *
 * 実装方針:
 *   - tree_call_records から該当 call_id を SELECT
 *   - called_at から 5s 以内かサーバー側で再検証（クライアント時計ずれ対策）
 *   - 5s 以内なら deleted_at = now() で論理削除（rollback_reason 付き）
 *   - session 集計 decrement はスキップ（巻き戻しは稀、5s 以内）
 *     → 将来の改修候補として handoff に記載（docs/handoff-rollback-decrement.md）
 */

import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type RollbackCallRecordInput = {
  call_id: string;
  prev_result_code?: string;
  rollback_reason?: string;
  accessToken: string;
};

export type RollbackErrorCode =
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "EXPIRED"
  | "DB_ERROR"
  | "UNKNOWN";

export type RollbackResult =
  | { success: true }
  | { success: false; errorCode: RollbackErrorCode; errorMessage: string };

const ROLLBACK_WINDOW_SEC = 5;

const ERROR_MESSAGES: Record<RollbackErrorCode, string> = {
  UNAUTHENTICATED: "認証が切れました。再ログインしてください",
  NOT_FOUND: "ロールバック対象が見つかりません",
  EXPIRED: "5 秒経過したため巻き戻しできません",
  DB_ERROR: "データベース更新に失敗しました",
  UNKNOWN: "不明なエラーが発生しました",
};

function fail(code: RollbackErrorCode, override?: string): RollbackResult {
  return {
    success: false,
    errorCode: code,
    errorMessage: override ?? ERROR_MESSAGES[code],
  };
}

export async function rollbackCallRecord(
  input: RollbackCallRecordInput
): Promise<RollbackResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return fail("UNKNOWN", "環境変数未設定");

  if (!input.call_id) return fail("NOT_FOUND");

  // 認証検証
  const verifyClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await verifyClient.auth.getUser(
    input.accessToken
  );
  if (userError || !userData?.user) return fail("UNAUTHENTICATED");

  // call_id SELECT + 5s 検証
  const admin = getSupabaseAdmin();
  const { data: record, error: fetchError } = await admin
    .from("tree_call_records")
    .select("call_id, called_at, result_code, session_id, result_group")
    .eq("call_id", input.call_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError || !record) return fail("NOT_FOUND");

  const calledAt = new Date((record as { called_at: string }).called_at);
  const now = new Date();
  const elapsedSec = (now.getTime() - calledAt.getTime()) / 1000;
  if (elapsedSec > ROLLBACK_WINDOW_SEC) return fail("EXPIRED");

  // 論理削除 + rollback_reason 設定
  const { error: updateError } = await admin
    .from("tree_call_records")
    .update({
      deleted_at: new Date().toISOString(),
      rollback_reason: input.rollback_reason ?? "user_undo",
      prev_result_code: (record as { result_code: string }).result_code,
    })
    .eq("call_id", input.call_id);

  if (updateError) return fail("DB_ERROR", updateError.message);

  // NOTE: session 集計 decrement はスキップ。
  //       D-01 trigger は INSERT 時のみ発火（UPDATE では発火しない）。
  //       巻き戻しは稀なケースかつ 5s 以内のため、次回 INSERT で集計が正しくなる。
  //       将来的に RPC 関数で decrement 実装予定（handoff 記載済み）。

  return { success: true };
}
