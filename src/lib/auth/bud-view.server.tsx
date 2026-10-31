import HelpButton from "@/app/system/_components/HelpButton/HelpButton";
import SystemTabs from "@/app/system/_components/SystemTabs/SystemTabs";
import "server-only";
import type { ReactNode } from "react";
import { cache } from "react";
import { BUD_PAGES, BUD_TABS, BUD_DEFAULT_ROLES } from "./bud-view-scopes";
import { canView, viewPermissionContext, ViewPermissionError } from "./view-permission.server";
import { SystemViewProvider } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";
import { BudViewChrome } from "@/app/bud/_components/BudViewChrome";

export const budViewContext = cache(async () => {
  const context = await viewPermissionContext();
  const access = await context.db.rpc("bud_has_access");
  if (access.error) throw new ViewPermissionError("Bud の権限を確認できませんでした。", 503);
  return { ...context, defaultAllowed: access.data === true && BUD_DEFAULT_ROLES.includes(context.viewer.role) };
});
export async function canViewBud(pageKey: string, tabKey?: string): Promise<boolean> {
  const context = await budViewContext();
  const tabs = tabKey === undefined ? BUD_TABS[pageKey.slice(4)] ?? [] : [];
  return tabs.length
    ? (await Promise.all(tabs.map(([tab]) => canViewBud(pageKey, tab)))).some(Boolean)
    : canView(pageKey, tabKey ?? "", context.viewer, context.defaultAllowed && !(pageKey === "bud-expenses" && tabKey === "deleted" && context.viewer.role !== "super_admin"));
}
export async function budViewNavigation() {
  try {
    return Object.fromEntries(await Promise.all(BUD_PAGES.map(async ([key]) => [`bud-${key}`, await canViewBud(`bud-${key}`)])));
  } catch (error) {
    if (error instanceof ViewPermissionError && error.status < 500) return {};
    throw error;
  }
}
export async function budViewResponse(pageKey: string, tabKey?: string) {
  try {
    if (!await canViewBud(pageKey, tabKey)) throw new ViewPermissionError("閲覧権限がありません");
    return null;
  } catch (error) {
    if (error instanceof ViewPermissionError) return Response.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "private, no-store" } });
    throw error;
  }
}
/** 閲覧設定で追加された人には、従来の Bud 利用権限を付与しない。既存の操作別判定も残す。 */
export async function budWriteResponse() {
  try {
    if (!(await budViewContext()).defaultAllowed) throw new ViewPermissionError("操作する権限がありません");
    return null;
  } catch (error) {
    if (error instanceof ViewPermissionError) return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
export async function BudView({ pageKey, tabKey, children }: { pageKey: string; tabKey?: string; children: ReactNode }) {
  try {
    const context = await budViewContext();
    if (!await canViewBud(pageKey, tabKey)) return <main><div className="garden-help-heading"><h1>閲覧権限がありません</h1><HelpButton /></div><SystemTabs /></main>;
    const tabs = await Promise.all((BUD_TABS[pageKey.slice(4)] ?? []).map(async ([key, label]) => ({ key, label, allowed: await canViewBud(pageKey, key), canAdd: false })));
    return <SystemViewProvider value={{ pageKey, admin: context.viewer.role === "super_admin", tabs, canAdd: false }}><BudViewChrome tabKey={tabKey}>{children}</BudViewChrome></SystemViewProvider>;
  } catch (error) {
    if (error instanceof ViewPermissionError && error.status < 500) return <main><div className="garden-help-heading"><h1>{error.message}</h1><HelpButton /></div><SystemTabs /><a href="/bud/login">ログイン</a></main>;
    throw error;
  }
}
