import "server-only";
import { cache } from "react";
import { createServerClient } from "@/app/_lib/supabase/server";
import { GARDEN_ROLE_ORDER, type GardenRole } from "@/app/root/_constants/types";
import { isEmployeeActive } from "./employee-access";
import { permissionEntry, resolveCanView, type ViewPermission, type Viewer } from "./view-permission";
import { SYSTEM_VIEW_SCOPES } from "./system-view-scopes";

export class ViewPermissionError extends Error {
  constructor(message: string, public status = 403) { super(message); }
}
export const viewPermissionContext = cache(async () => {
  const db = await createServerClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new ViewPermissionError("ログインし直してください。", 401);
  const { data, error } = await db.from("root_employees").select("employee_id,name,garden_role,is_active,termination_date,deleted_at").eq("user_id", user.id).eq("is_active", true).is("deleted_at", null).maybeSingle();
  if (error || !data || !isEmployeeActive(data) || !GARDEN_ROLE_ORDER.includes(data.garden_role as GardenRole)) throw new ViewPermissionError("閲覧権限がありません");
  return { db, userId: user.id, name: String(data.name), viewer: { employeeId: String(data.employee_id), role: data.garden_role as GardenRole } };
});
// React cache はサーバーの同じ描画内だけで共有する。全画面・全タブを一度に読む。
export const readViewPermissions = cache(async (): Promise<ViewPermission[]> => {
  const { db } = await viewPermissionContext();
  const { data, error } = await db.from("system_view_permissions").select("*");
  if (error) {
    // migration 適用前だけ既定を使う。通信障害などでは権限を広げない。
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    throw new ViewPermissionError("閲覧設定を読み込めませんでした。", 503);
  }
  return (data ?? []) as ViewPermission[];
});
export async function canView(pageKey: string, tabKey: string, viewer: Viewer, defaultAllowed?: boolean) {
  if (!permissionEntry(pageKey, tabKey)) return false;
  if (viewer.role === "super_admin") return true;
  return resolveCanView(await readViewPermissions(), pageKey, tabKey, viewer, defaultAllowed);
}

/** メニューは従来の表示条件を保ち、設定後は閲覧できるタブがひとつでもあれば表示する。 */
export async function canViewSystemMenu(pageKey: string, viewer: Viewer, defaultAllowed: boolean) {
  const tabs = SYSTEM_VIEW_SCOPES.filter(scope => scope.pageKey === pageKey && scope.tabKey);
  if (!tabs.length) return canView(pageKey, "", viewer, defaultAllowed);
  const allowed = await Promise.all(tabs.map(scope => canView(pageKey, scope.tabKey, viewer, defaultAllowed && scope.defaultRoles.includes(viewer.role))));
  return allowed.some(Boolean);
}

export async function canReadSystemScope(pageKey: string, tabKey: string, viewer: Viewer, defaultAllowed?: boolean) {
  const tabs = tabKey ? [] : SYSTEM_VIEW_SCOPES.filter(scope => scope.pageKey === pageKey && scope.tabKey);
  return tabs.length
    ? (await Promise.all(tabs.map(scope => canView(pageKey, scope.tabKey, viewer, defaultAllowed)))).some(Boolean)
    : canView(pageKey, tabKey, viewer, defaultAllowed);
}

export async function requireSystemView(pageKey: string, tabKey = "", defaultAllowed?: boolean) {
  const context = await viewPermissionContext();
  if (!await canView(pageKey, tabKey, context.viewer, defaultAllowed)) throw new ViewPermissionError("閲覧権限がありません");
  return context;
}

/** API の読み取りの前に使用。書き込みの役職判定の代わりには使わない。 */
export async function systemViewResponse(pageKey: string, tabKey = "", defaultAllowed?: boolean) {
  try {
    const { viewer } = await viewPermissionContext();
    if (!await canReadSystemScope(pageKey, tabKey, viewer, defaultAllowed)) throw new ViewPermissionError("閲覧権限がありません");
    return null;
  }
  catch (error) {
    if (error instanceof ViewPermissionError) return Response.json({ ok: false, error: error.message }, { status: error.status });
    throw error;
  }
}
