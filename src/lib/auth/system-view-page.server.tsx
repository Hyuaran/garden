import "server-only";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { SYSTEM_VIEW_SCOPES } from "./system-view-scopes";
import { canView, readViewPermissions, viewPermissionContext, ViewPermissionError } from "./view-permission.server";
import { effectivePermission } from "./view-permission";
import { SystemViewProvider } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";

export async function systemViewState(pageKey: string) {
  const { viewer } = await viewPermissionContext();
  const settings = await readViewPermissions();
  const tabs = await Promise.all(SYSTEM_VIEW_SCOPES.filter(scope => scope.pageKey === pageKey && scope.tabKey).map(async scope => ({
    key: scope.tabKey, label: scope.label, allowed: await canView(pageKey, scope.tabKey, viewer),
    canAdd: Boolean(effectivePermission(settings, pageKey, scope.tabKey)?.viewers_can_add),
  })));
  return { pageKey, admin: viewer.role === "super_admin", tabs, canAdd: Boolean(effectivePermission(settings, pageKey)?.viewers_can_add),
    allowed: tabs.length ? tabs.some(tab => tab.allowed) || (!settings.some(row => row.page_key === pageKey) && await canView(pageKey, "", viewer)) : await canView(pageKey, "", viewer) };
}

// ページ本体を呼ぶ前に判定する。layout の判定だけでは子ページのデータ取得を止められない。
export function withSystemView<Args extends unknown[]>(pageKey: string, Page: (...args: Args) => ReactNode | Promise<ReactNode>, tabKey?: string, href?: string) {
  return async function SystemViewPage(...args: Args) {
    let state;
    try { state = await systemViewState(pageKey); }
    catch (error) {
      if (error instanceof ViewPermissionError && error.status === 401) redirect(`/login?returnTo=${encodeURIComponent(href ?? (pageKey === "system-home" ? "/system" : `/system/${pageKey.slice(7)}`))}`);
      throw error;
    }
    if (!state.allowed || (tabKey !== undefined && !await canView(pageKey, tabKey, (await viewPermissionContext()).viewer))) return <main style={{ padding: 32 }}><h1>閲覧権限がありません</h1></main>;
    return <SystemViewProvider value={state}>{await Page(...args)}</SystemViewProvider>;
  };
}
