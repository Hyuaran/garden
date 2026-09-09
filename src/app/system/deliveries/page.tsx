import { redirect } from "next/navigation";
import { createServerClient } from "@/app/_lib/supabase/server";
import { GARDEN_ROLE_ORDER, type GardenRole } from "@/app/root/_constants/types";
import { isEmployeeActive } from "@/lib/auth/employee-access";
import DeliveriesHubClient from "./DeliveriesHubClient";
import { getVisibleSystemDeliveries } from "./_lib/deliveries-registry";

export const metadata = { title: "自動配信 | Garden" };

export default async function DeliveriesHubPage() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?returnTo=%2Fsystem%2Fdeliveries");

  const { data: employee } = await supabase
    .from("root_employees")
    .select("garden_role,is_active,termination_date,deleted_at")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (!employee || !isEmployeeActive(employee)) redirect("/login?returnTo=%2Fsystem%2Fdeliveries");

  const role = GARDEN_ROLE_ORDER.includes(employee.garden_role as GardenRole)
    ? employee.garden_role as GardenRole
    : "staff";

  return <DeliveriesHubClient deliveries={getVisibleSystemDeliveries(role)} />;
}
