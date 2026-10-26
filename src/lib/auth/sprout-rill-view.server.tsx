import "server-only";
import type { ReactNode } from "react";
import { canView, viewPermissionContext, ViewPermissionError } from "./view-permission.server";
import { SPROUT_RILL_TABS } from "./sprout-rill-view-scopes";
import { isRoleAtLeast } from "@/app/root/_constants/types";
import { SystemViewProvider } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";

export async function canViewRecruitMail(page: string, tab?: string, navigation = false): Promise<boolean> {
  const { viewer } = await viewPermissionContext();
  const defaults = page.startsWith("sprout-") ? (navigation ? isRoleAtLeast(viewer.role, "staff") : viewer.role === "super_admin") : isRoleAtLeast(viewer.role, "admin");
  if (tab !== undefined) return canView(page, tab, viewer, defaults);
  return (await Promise.all((SPROUT_RILL_TABS[page] ?? []).map(([key]) => canView(page, key, viewer, defaults)))).some(Boolean);
}
export async function requireRecruitMailRead(page: string, tab?: string) {
  if (tab !== undefined && !SPROUT_RILL_TABS[page]?.some(([key]) => key === tab)) throw new ViewPermissionError("閲覧権限がありません");
  if (!await canViewRecruitMail(page, tab)) throw new ViewPermissionError("閲覧権限がありません");
  return viewPermissionContext();
}
export async function RecruitMailView({ page, children, fallback }: { page: string; children: ReactNode; fallback?: ReactNode }) {
  const context = await viewPermissionContext();
  if (!await canViewRecruitMail(page)) return fallback ?? <main><h1>閲覧権限がありません</h1></main>;
  const tabs = await Promise.all(SPROUT_RILL_TABS[page].map(async ([key, label]) => ({ key, label, allowed: await canViewRecruitMail(page, key), canAdd: false })));
  return <SystemViewProvider key={page + tabs.map(tab => `${tab.key}:${tab.allowed}`).join(",")} value={{ pageKey: page, admin: context.viewer.role === "super_admin", tabs, canAdd: false }}>{children}</SystemViewProvider>;
}
