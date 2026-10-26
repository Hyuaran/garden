import "server-only";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { ROOT_VIEW_SCOPES } from "./root-view-scopes";
import { canView, viewPermissionContext, ViewPermissionError } from "./view-permission.server";
import { SystemViewProvider } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";

export async function rootViewNavigation() {
  try {
    const { viewer } = await viewPermissionContext();
    return Object.fromEntries(await Promise.all(ROOT_VIEW_SCOPES.map(async scope =>
      [scope.pageKey, await canView(scope.pageKey, "", viewer)] as const)));
  } catch (error) {
    if (error instanceof ViewPermissionError && [401, 403].includes(error.status)) return {};
    throw error;
  }
}

export async function RootView({ pageKey, children }: { pageKey: string; children: ReactNode }) {
  let context;
  try { context = await viewPermissionContext(); }
  catch (error) {
    if (error instanceof ViewPermissionError && error.status === 401) redirect(`/login?returnTo=${encodeURIComponent(pageKey === "root-home" ? "/root" : `/root/${pageKey.slice(5)}`)}`);
    throw error;
  }
  if (!await canView(pageKey, "", context.viewer)) return <main style={{ padding: 32 }}><h1>閲覧権限がありません</h1></main>;
  return <SystemViewProvider value={{ pageKey, admin: context.viewer.role === "super_admin", tabs: [], canAdd: false }}>{children}</SystemViewProvider>;
}
