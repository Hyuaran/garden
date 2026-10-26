import { SYSTEM_VIEW_SCOPES } from "./system-view-scopes";
import { ROOT_VIEW_SCOPES } from "./root-view-scopes";
import type { GardenRole } from "@/app/root/_constants/types";

export type ViewPermission = { page_key: string; tab_key: string; roles: string[]; employee_ids: string[]; viewers_can_add: boolean; updated_by: string; updated_at: string };
export type Viewer = { employeeId: string; role: GardenRole };
export function permissionEntry(page: string, tab = "") {
  const scopes = [...SYSTEM_VIEW_SCOPES, ...ROOT_VIEW_SCOPES];
  const scope = scopes.find(entry => entry.pageKey === page && entry.tabKey === tab);
  if (scope) return { pageKey: page, tabKey: tab,
    label: tab ? `${scopes.find(entry => entry.pageKey === page && !entry.tabKey)?.label}：${scope.label}` : scope.label,
    allows: (role: GardenRole) => scope.defaultRoles.includes(role) };
  if (page !== "system-onboarding" || !["", "self", "candidates", "confirmations", "all"].includes(tab)) return undefined;
  const labels: Record<string, string> = { "": "入社手続き", self: "自分の入社手続き", candidates: "入社予定者", confirmations: "入社後の確認", all: "みんなの入社手続き" };
  return { pageKey: page, tabKey: tab, label: tab ? `入社手続き：${labels[tab]}` : labels[tab], allows: (role: GardenRole) => tab === "" || tab === "self" || (tab === "all" ? ["manager", "admin", "super_admin"].includes(role) : role === "super_admin") };
}
export function effectivePermission(rows: ViewPermission[], page: string, tab = "") {
  return rows.find(row => row.page_key === page && row.tab_key === tab)
    ?? rows.find(row => row.page_key === page && row.tab_key === "");
}
export function resolveCanView(rows: ViewPermission[], page: string, tab: string, viewer: Viewer, defaultAllowed?: boolean) {
  if (page === "system-dev-board") return viewer.employeeId === "EMP-0008";
  if (!permissionEntry(page, tab)) return false;
  if (viewer.role === "super_admin") return true;
  const setting = effectivePermission(rows, page, tab);
  return setting ? setting.roles.includes(viewer.role) || setting.employee_ids.includes(viewer.employeeId)
    : defaultAllowed ?? Boolean(permissionEntry(page, tab)?.allows(viewer.role));
}
