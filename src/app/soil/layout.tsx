import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { canView, viewPermissionContext, ViewPermissionError } from "@/lib/auth/view-permission.server";
import { SOIL_VIEW_SCOPES } from "@/lib/auth/soil-view-scopes";
import { SoilShell } from "./_components/SoilShell";

export const metadata = { title: "Soil | Garden" };

export default async function Layout({ children }: { children: ReactNode }) {
  let context;
  try {
    context = await viewPermissionContext();
  } catch (error) {
    if (error instanceof ViewPermissionError && error.status === 401) {
      const requested = (await headers()).get("x-pathname") || "/soil";
      const returnTo = /^\/soil(\/|\?|$)/.test(requested) ? requested : "/soil";
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
    SOIL_VIEW_SCOPES.map(async scope => [scope.pageKey, await canView(scope.pageKey, "", viewer)]),
  ));
  return (
    <SoilShell viewAccess={viewAccess} user={{ name, role: viewer.role, company: company?.company_name || "所属会社未登録" }}>
      <div className="garden-table-head-center" style={{ display: "contents" }}>{children}</div>
    </SoilShell>
  );
}
