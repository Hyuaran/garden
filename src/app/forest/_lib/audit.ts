/**
 * Garden-Forest 監査ログ
 *
 * forest_audit_log に操作を記録。
 * RLS:
 *  - authenticated ユーザー: 全 action を INSERT 可
 *  - anon ユーザー: login_failed (user_id IS NULL) のみ INSERT 可
 *    （ブルートフォース検知のため認証前でも記録が必要）
 */

import { supabase } from "./supabase";

export type AuditAction =
  | "login"
  | "login_failed"
  | "logout_manual"
  | "logout_timeout"
  | "view_dashboard"
  | "view_detail"
  | "click_drive_link";

export async function writeAuditLog(
  action: AuditAction,
  target?: string,
): Promise<void> {
  // login_failed は認証前（anon）でも記録する必要がある
  // RLS: forest_audit_anon_login_failed ポリシーが anon の INSERT を許可
  if (action === "login_failed") {
    const { error } = await supabase.from("forest_audit_log").insert({
      user_id: null, // 認証前なので null
      action,
      target: target ?? null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      ip_address: null,
    });
    if (error) {
      console.error("[forest-audit] Failed to write login_failed log:", error.message);
    }
    return;
  }

  // その他のアクションは認証済みユーザーのみ記録
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.from("forest_audit_log").insert({
    user_id: user.id,
    action,
    target: target ?? null,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    // ip_address は Supabase Edge Function 側で取得する方が正確だが、
    // Phase A ではクライアントから取得しない（null）
    ip_address: null,
  });
  if (error) {
    console.error("[forest-audit] Failed to write log:", error.message);
  }
}
