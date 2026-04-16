/**
 * Garden-Forest 監査ログ
 *
 * forest_audit_log に操作を記録。
 * RLS: INSERT は任意の authenticated ユーザーが可能。
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return; // 未認証なら記録しない

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
