import { redirect } from "next/navigation";
import { createServerClient } from "@/app/_lib/supabase/server";
import { GARDEN_ROLE_ORDER, type GardenRole } from "@/app/root/_constants/types";
import ShachoShell from "../../_components/ShachoShell/ShachoShell";
import { shouldHideSidebar } from "../../_components/ShachoShell/shacho-shell-config";
import { buildMyPageProfile } from "../_lib/mypage-profile.server";
import MyPageClient from "../MyPageClient";
import { MY_PAGE_ROUTES, type MyPageProfile, type MyPageTab } from "../types";

const MANAGER_ROLES = new Set(["manager", "admin", "super_admin"]);

export default async function MyPageSectionPage({ section }: { section: MyPageTab }) {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const returnTo = encodeURIComponent(MY_PAGE_ROUTES[section]);
  if (!auth.user) redirect(`/login?returnTo=${returnTo}`);

  const { data: employee } = await supabase.from("root_employees")
    .select("employee_id,name,name_kana,employee_number,employment_type,birthday,email,garden_role,company_id,commute_daily_allowance,commute_monthly_cap")
    .eq("user_id", auth.user.id).eq("is_active", true).is("deleted_at", null).maybeSingle();
  const birthdayRegistered = typeof employee?.birthday === "string" && employee.birthday.length > 0;
  const role = employee && GARDEN_ROLE_ORDER.includes(employee.garden_role as GardenRole) ? employee.garden_role as GardenRole : "staff";
  const tabbed = shouldHideSidebar(role);
  const initialProfile: MyPageProfile | null = employee && !birthdayRegistered && (tabbed || section === "profile") ? await buildMyPageProfile(employee) : null;
  const postalDataStatus = (await supabase.from("system_postal_datasets").select("source_date,imported_at").eq("active", true).maybeSingle()).data;
  const company = employee?.company_id ? (await supabase.from("root_companies").select("company_name").eq("company_id", employee.company_id).maybeSingle()).data : null;

  return <ShachoShell activePath={MY_PAGE_ROUTES[section]} user={{
    name: String(employee?.name ?? "未登録"),
    company: String(company?.company_name ?? "所属会社未登録"),
    role,
  }}><MyPageClient
    initialTab={section}
    tabbed={tabbed}
    registered={Boolean(employee)}
    employeeName={employee?.name ? String(employee.name) : null}
    canViewSync={employee ? MANAGER_ROLES.has(String(employee.garden_role)) : false}
    birthdayRegistered={birthdayRegistered}
    initialProfile={initialProfile}
    postalDataStatus={postalDataStatus ? {
      sourceDate: String(postalDataStatus.source_date),
      importedAt: String(postalDataStatus.imported_at),
    } : null}
  /></ShachoShell>;
}
