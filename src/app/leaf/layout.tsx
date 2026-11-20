import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { canView, viewPermissionContext, ViewPermissionError } from "@/lib/auth/view-permission.server";
import { LEAF_VIEW_SCOPES } from "@/lib/auth/leaf-view-scopes";
import { LeafShell } from "./_components/LeafShell";
import { japanDate } from "@/lib/notices";
import { ENTRY_SCOPE, ENTRY_START } from "./kanden/entry/entry";

export const metadata = { title: "Leaf | Garden" };

export default async function Layout({ children }: { children: ReactNode }) {
  let context;
  try {
    context = await viewPermissionContext();
  } catch (error) {
    if (error instanceof ViewPermissionError && error.status === 401) {
      const requested = (await headers()).get("x-pathname") || "/leaf";
      const returnTo = /^\/leaf(\/|\?|$)/.test(requested) ? requested : "/leaf";
      redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    }
    throw error;
  }
  const { db, viewer, userId, name } = context;
  const { data: employee } = await db.from("root_employees")
    .select("company_id").eq("user_id", userId).maybeSingle();
  const company = employee?.company_id
    ? (await db.from("root_companies").select("company_name")
      .eq("company_id", employee.company_id).maybeSingle()).data
    : null;
  const viewAccess = Object.fromEntries(await Promise.all(
    LEAF_VIEW_SCOPES.map(async scope => [scope.pageKey, await canView(scope.pageKey, "", viewer)]),
  ));
  // 12/1 の展開までは全権管理者だけ（試し使い）
  if (japanDate() < ENTRY_START && viewer.role !== "super_admin") viewAccess[ENTRY_SCOPE] = false;
  return (
    <LeafShell viewAccess={viewAccess} user={{ name, role: viewer.role, company: company?.company_name || "所属会社未登録" }}>
      <div className="garden-table-head-center" style={{ display: "contents" }}>{children}</div>
    </LeafShell>
  );
}
