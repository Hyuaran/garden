import { redirect } from "next/navigation";
import { createServerClient } from "@/app/_lib/supabase/server";
import MyPageClient from "./MyPageClient";
import type { MyPageProfile, MyPageTab } from "./types";
import { buildMyPageProfile } from "./_lib/mypage-profile.server";

export const metadata = { title: "マイページ | Garden" };
const MANAGER_ROLES = new Set(["manager", "admin", "super_admin"]);
const TABS = new Set<MyPageTab>(["profile", "attendance", "shift", "zenkaku"]);

export default async function MyPagePage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?returnTo=%2Fsystem%2Fmypage");
  const { data: employee } = await supabase.from("root_employees")
    .select("id,name,name_kana,employee_number,employment_type,birthday,email,garden_role,commute_daily_allowance,commute_monthly_cap")
    .eq("user_id", auth.user.id).eq("is_active", true).is("deleted_at", null).maybeSingle();
  const rawTab = (await searchParams).tab;
  const requestedTab = typeof rawTab === "string" && TABS.has(rawTab as MyPageTab) ? rawTab as MyPageTab : "profile";
  const birthdayRegistered = typeof employee?.birthday === "string" && employee.birthday.length > 0;
  const initialProfile: MyPageProfile | null = employee && !birthdayRegistered ? await buildMyPageProfile(employee) : null;
  const postalDataStatus = (await supabase.from("system_postal_datasets").select("source_date,imported_at").eq("active", true).maybeSingle()).data;
  return <MyPageClient initialTab={requestedTab} registered={Boolean(employee)} employeeName={employee?.name ? String(employee.name) : null}
    canViewSync={employee ? MANAGER_ROLES.has(String(employee.garden_role)) : false}
    birthdayRegistered={birthdayRegistered} initialProfile={initialProfile} postalDataStatus={postalDataStatus ? { sourceDate: String(postalDataStatus.source_date), importedAt: String(postalDataStatus.imported_at) } : null} />;
}
