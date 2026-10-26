import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@/app/_lib/supabase/server";
import { GARDEN_ROLE_ORDER, type GardenRole } from "@/app/root/_constants/types";
import { isEmployeeActive } from "@/lib/auth/employee-access";
import ShachoShell from "./_components/ShachoShell/ShachoShell";
import { canViewSystemMenu, viewPermissionContext } from "@/lib/auth/view-permission.server";
import { SYSTEM_MENU_ITEMS, LIMITED_MENU_ITEMS, shouldHideSidebar, canUseSystemItem } from "./_components/ShachoShell/shacho-shell-config";
import { systemPageKey } from "@/lib/auth/system-view-scopes";

export default async function SystemLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  // ログイン後の戻り先＝開こうとしていた画面（以前は常に /system に戻していたため、フォームの URL を直接開いてもホームに飛んでいた・2026-10-13 修正）
  const requested = (await headers()).get("x-pathname") || "";
  const returnTo = encodeURIComponent(/^\/system(\/|\?|$)/.test(requested) ? requested : "/system");
  if (!auth.user) redirect(`/login?returnTo=${returnTo}`);

  const { data: employee } = await supabase
    .from("root_employees")
    .select("name,garden_role,company_id,is_active,termination_date,deleted_at")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (!employee || !isEmployeeActive(employee)) redirect(`/login?returnTo=${returnTo}`);

  const role = GARDEN_ROLE_ORDER.includes(employee.garden_role as GardenRole)
    ? employee.garden_role as GardenRole
    : "staff";
  const company = employee.company_id
    ? (await supabase
        .from("root_companies")
        .select("company_name")
        .eq("company_id", employee.company_id)
        .maybeSingle()).data
    : null;

  const { viewer } = await viewPermissionContext();
  const menuPermissions = await Promise.all(SYSTEM_MENU_ITEMS.filter(item => item.href && systemPageKey(item.href)).map(async item => {
    const defaultAllowed = shouldHideSidebar(role) ? LIMITED_MENU_ITEMS.some(limited => limited.href === item.href) : canUseSystemItem(item, role);
    const pageKey = systemPageKey(item.href!)!;
    return { href: item.href!, allowed: await canViewSystemMenu(pageKey, viewer, defaultAllowed) };
  }));
  return (
    <ShachoShell allowedHrefs={menuPermissions.filter(item => item.allowed).map(item => item.href)} hiddenHrefs={menuPermissions.filter(item => !item.allowed).map(item => item.href)} user={{
      name: String(employee.name),
      company: String(company?.company_name ?? "所属会社未登録"),
      role,
    }}>
      <div className="garden-table-head-center" style={{ display: "contents" }}>{children}</div>
    </ShachoShell>
  );
}
