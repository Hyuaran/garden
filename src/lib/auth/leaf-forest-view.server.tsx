import HelpButton from "@/app/system/_components/HelpButton/HelpButton";
import SystemTabs from "@/app/system/_components/SystemTabs/SystemTabs";
import "server-only";
import { cache, type ReactNode } from "react";
import { canView, viewPermissionContext, ViewPermissionError } from "./view-permission.server";
import { LEAF_FOREST_PAGES, LEAF_FOREST_TABS, LEAF_FOREST_VIEW_SCOPES } from "./leaf-forest-view-scopes";
import { SystemViewProvider } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";
import { LeafForestNavigation } from "./leaf-forest-view.client";

export async function canViewLeafForest(page: string, tab?: string, defaultAllowed?: boolean): Promise<boolean> {
  const { viewer } = await viewPermissionContext();
  if (tab === undefined && LEAF_FOREST_TABS[page]?.length) return (await Promise.all(LEAF_FOREST_TABS[page].map(([key]) => canView(page, key, viewer, defaultAllowed)))).some(Boolean);
  return canView(page, tab ?? "", viewer, defaultAllowed);
}
export async function requireLeafForestRead(page: string, tab?: string, defaultAllowed?: boolean) {
  if (!await canViewLeafForest(page, tab, defaultAllowed)) throw new ViewPermissionError("閲覧権限がありません");
  return viewPermissionContext();
}
export const forestLegacyReader = cache(async () => {
  const context = await viewPermissionContext();
  const { data, error } = await context.db.from("forest_users").select("role").eq("user_id", context.userId).maybeSingle();
  if (error) throw new ViewPermissionError("Forest の権限を確認できませんでした。", 503);
  return data;
});
export async function requireForestDataRead(page: string, tab?: string) {
  if (!LEAF_FOREST_VIEW_SCOPES.some(scope => scope.pageKey === page && scope.pageKey.startsWith("forest-") && (!tab || scope.tabKey === tab))) throw new ViewPermissionError("閲覧権限がありません");
  const { viewer } = await viewPermissionContext();
  const defaults = !!await forestLegacyReader() && LEAF_FOREST_VIEW_SCOPES.find(scope => scope.pageKey === page)!.defaultRoles.includes(viewer.role);
  return requireLeafForestRead(page, tab, defaults);
}
export async function LeafForestLayout({ module, children }: { module: string; children: ReactNode }) {
  try {
    const entries = await Promise.all(LEAF_FOREST_PAGES.filter(([key]) => key.startsWith(module + "-")).map(async ([key]) => [key, await canViewLeafForest(key)] as const));
    if (!entries.some(([, allowed]) => allowed)) return <main><div className="garden-help-heading"><h1>閲覧権限がありません</h1><HelpButton /></div><SystemTabs /></main>;
    return <LeafForestNavigation allowed={Object.fromEntries(entries)}>{children}</LeafForestNavigation>;
  } catch (error) {
    if (error instanceof ViewPermissionError && error.status < 500) return <main><div className="garden-help-heading"><h1>{error.message}</h1><HelpButton /></div><SystemTabs /><a href="/login">ログイン</a></main>;
    throw error;
  }
}
export async function LeafForestView({ page, children }: { page: string; children: ReactNode }) {
  try {
    const { viewer } = await requireLeafForestRead(page);
    const tabs = await Promise.all((LEAF_FOREST_TABS[page] ?? []).map(async ([key, label]) => ({ key, label, allowed: await canViewLeafForest(page, key), canAdd: false })));
    return <SystemViewProvider value={{ pageKey: page, admin: viewer.role === "super_admin", tabs, canAdd: false }}>{children}</SystemViewProvider>;
  } catch (error) {
    if (error instanceof ViewPermissionError && error.status < 500) return <main><div className="garden-help-heading"><h1>{error.message}</h1><HelpButton /></div><SystemTabs /><a href="/login">ログイン</a></main>;
    throw error;
  }
}
