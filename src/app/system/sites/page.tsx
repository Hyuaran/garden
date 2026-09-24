import { redirect } from "next/navigation";
import { createServerClient } from "@/app/_lib/supabase/server";
import { GARDEN_ROLE_ORDER, type GardenRole, isRoleAtLeast } from "@/app/root/_constants/types";
import { isEmployeeActive } from "@/lib/auth/employee-access";
import SitesHubClient from "./SitesHubClient";
import { CORPORATE_SITES_DATA } from "./_lib/sites-registry";

export const metadata = { title: "コーポレートサイト | Garden" };

export default async function CorporateSitesPage() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?returnTo=%2Fsystem%2Fsites");

  const { data: employee } = await supabase
    .from("root_employees")
    .select("garden_role,is_active,termination_date,deleted_at")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (!employee || !isEmployeeActive(employee)) redirect("/login?returnTo=%2Fsystem%2Fsites");

  const role = GARDEN_ROLE_ORDER.includes(employee.garden_role as GardenRole)
    ? employee.garden_role as GardenRole
    : "staff";
  if (!isRoleAtLeast(role, "staff")) redirect("/system");

  return <SitesHubClient data={CORPORATE_SITES_DATA} />;
}
