import { redirect } from "next/navigation";
import { createServerClient } from "@/app/_lib/supabase/server";
import { GARDEN_ROLE_ORDER, type GardenRole } from "@/app/root/_constants/types";
import { isEmployeeActive } from "@/lib/auth/employee-access";
import ManualsHubClient from "./ManualsHubClient";
import { getManualModules } from "./_lib/manuals-registry";

export const metadata = { title: "マニュアル | Garden" };

export default async function ManualsHubPage() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?returnTo=%2Fsystem%2Fmanuals");

  const { data: employee } = await supabase
    .from("root_employees")
    .select("garden_role,is_active,termination_date,deleted_at")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (!employee || !isEmployeeActive(employee)) redirect("/login?returnTo=%2Fsystem%2Fmanuals");

  const role = GARDEN_ROLE_ORDER.includes(employee.garden_role as GardenRole)
    ? employee.garden_role as GardenRole
    : "staff";

  return <ManualsHubClient modules={getManualModules(role)} />;
}
