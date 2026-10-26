import "server-only";
import { cache } from "react";
import { createServerClient } from "@/app/_lib/supabase/server";
import { GARDEN_ROLE_ORDER, type GardenRole } from "@/app/root/_constants/types";
import { isEmployeeActive } from "./employee-access";
import { resolveCanView, type ViewPermission, type Viewer } from "./view-permission";

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
export async function canView(pageKey: string, tabKey: string, viewer: Viewer) {
  if (viewer.role === "super_admin") return true;
  return resolveCanView(await readViewPermissions(), pageKey, tabKey, viewer);
}
