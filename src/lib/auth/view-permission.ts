import { PERMISSION_ENTRIES } from "./permission-registry";
import type { GardenRole } from "@/app/root/_constants/types";

export type ViewPermission = { page_key: string; tab_key: string; roles: string[]; employee_ids: string[]; viewers_can_add: boolean; updated_by: string; updated_at: string };
export type Viewer = { employeeId: string; role: GardenRole };
export function permissionEntry(page: string, tab = "") {
  return PERMISSION_ENTRIES.find(entry => entry.pageKey === page && entry.tabKey === tab);
}
export function effectivePermission(rows: ViewPermission[], page: string, tab = "") {
  return rows.find(row => row.page_key === page && row.tab_key === tab)
    ?? rows.find(row => row.page_key === page && row.tab_key === "");
}
export function resolveCanView(rows: ViewPermission[], page: string, tab: string, viewer: Viewer) {
  if (viewer.role === "super_admin") return true;
  if (!permissionEntry(page, tab)) return false;
  const setting = effectivePermission(rows, page, tab);
  return setting ? setting.roles.includes(viewer.role) || setting.employee_ids.includes(viewer.employeeId)
    : Boolean(permissionEntry(page, tab)?.allows(viewer.role));
}
