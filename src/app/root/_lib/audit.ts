/**
 * Garden-Root — 監査ログ書込
 *
 * root_audit_log テーブルに INSERT する薄いラッパ。
 * 書込失敗時は console.error だけで main 処理は止めない (設計書 §7)。
 *
 * 利用パターン:
 *   await writeAudit({
 *     action: "login_success",
 *     actorEmpNum: "0008",
 *     payload: { loginDurationMs: 42 }
 *   });
 */

import { supabase } from "./supabase";

export type AuditAction =
  | "login_success"
  | "login_failed"
  | "login_denied"
  | "logout"
  | "master_update"
  | "permission_denied";

export type AuditParams = {
  action: AuditAction;
  actorUserId?: string | null;
  actorEmpNum?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  payload?: Record<string, unknown>;
};

function getUserAgent(): string | null {
  if (typeof navigator === "undefined") return null;
  return navigator.userAgent;
}

export async function writeAudit(params: AuditParams): Promise<void> {
  try {
    const { error } = await supabase.from("root_audit_log").insert({
      actor_user_id: params.actorUserId ?? null,
      actor_emp_num: params.actorEmpNum ?? null,
      action: params.action,
      target_type: params.targetType ?? null,
      target_id: params.targetId ?? null,
      payload: params.payload ?? null,
      user_agent: getUserAgent(),
      // ip_address はサーバ側 default 値に任せる (フロント取得不可)
    });
    if (error) {
      console.error("[writeAudit]", error.message, params);
    }
  } catch (e) {
    console.error("[writeAudit] unexpected", e, params);
  }
}
