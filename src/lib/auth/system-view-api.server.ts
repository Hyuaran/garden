import "server-only";
import { canReadSystemScope, viewPermissionContext, ViewPermissionError } from "./view-permission.server";
import { requireEmployee, requireStaff, requireManager, requireAdmin } from "@/app/system/mypage/_lib/submission-server";

/** 読み取り専用。既定の API 判定を保ち、設定がある場合だけ閲覧者を変更する。本人の ID は常に維持する。 */
export async function requireViewEmployee(pageKey: string, tabKey = "", defaultRole: "employee" | "staff" | "manager" | "admin" = "employee") {
  const employee = await requireEmployee();
  if (!employee) return null;
  const defaults = { employee: requireEmployee, staff: requireStaff, manager: requireManager, admin: requireAdmin };
  const defaultAllowed = defaultRole === "employee" || Boolean(await defaults[defaultRole]());
  try {
    const { viewer } = await viewPermissionContext();
    const allowed = await canReadSystemScope(pageKey, tabKey, viewer, defaultAllowed);
    return allowed ? employee : null;
  } catch (error) {
    if (error instanceof ViewPermissionError && error.status < 500) return null;
    throw error;
  }
}
