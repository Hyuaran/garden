import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { createServerClient } from "@/app/_lib/supabase/server";
import { isEmployeeActive } from "@/lib/auth/employee-access";
import RillShachoShell from "./_components/RillShachoShell";

export const metadata = {
  title: "Garden-Rill - メッセージ",
};

const ROLE_ORDER = ["outsource", "toss", "closer", "cs", "staff", "manager", "admin", "super_admin"] as const;
const ROLE_LABELS: Record<string, string> = {
  super_admin: "全権管理者",
  admin: "管理者",
  manager: "マネージャー",
  staff: "正社員",
  cs: "CS",
  closer: "クローザー",
  toss: "トス",
  outsource: "外部スタッフ",
};

function isRoleAtLeast(role: string | null | undefined, minimum: string): boolean {
  const roleIndex = ROLE_ORDER.indexOf(role as (typeof ROLE_ORDER)[number]);
  const minimumIndex = ROLE_ORDER.indexOf(minimum as (typeof ROLE_ORDER)[number]);
  return roleIndex >= 0 && minimumIndex >= 0 && roleIndex >= minimumIndex;
}

export default async function RillLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?returnTo=%2Frill");

  const { data: employee } = await supabase
    .from("root_employees")
    .select("name,garden_role,company_id,is_active,termination_date,deleted_at")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (!employee || !isEmployeeActive(employee)) redirect("/login?returnTo=%2Frill");

  const role = typeof employee.garden_role === "string" ? employee.garden_role : "staff";
  if (!isRoleAtLeast(role, "admin")) redirect("/access-denied?module=rill");

  const company = employee.company_id
    ? (await supabase
        .from("root_companies")
        .select("company_name")
        .eq("company_id", employee.company_id)
        .maybeSingle()).data
    : null;

  return (
    <RillShachoShell user={{
      name: String(employee.name),
      company: String(company?.company_name ?? "所属会社未登録"),
      role,
      roleLabel: ROLE_LABELS[role] ?? "正社員",
    }}>
      {children}
    </RillShachoShell>
  );
}
