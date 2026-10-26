import { canView, viewPermissionContext } from "@/lib/auth/view-permission.server";
import { withSystemView } from "@/lib/auth/system-view-page.server";
import { redirect } from "next/navigation";
import { createServerClient } from "@/app/_lib/supabase/server";
import { GARDEN_ROLE_ORDER, type GardenRole } from "@/app/root/_constants/types";
import { isEmployeeActive } from "@/lib/auth/employee-access";
import DeliveriesHubClient from "./DeliveriesHubClient";
import { SYSTEM_DELIVERIES, getVisibleSystemDeliveries } from "./_lib/deliveries-registry";

export const metadata = { title: "自動配信 | Garden" };

async function DeliveriesHubPage() {
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

  const { viewer } = await viewPermissionContext();
  const defaults = getVisibleSystemDeliveries(role);
  const access = await Promise.all(SYSTEM_DELIVERIES.map(item => canView("system-deliveries", "", viewer, defaults.includes(item))));
  return <DeliveriesHubClient deliveries={SYSTEM_DELIVERIES.filter((_, i) => access[i])} />;
}

export default withSystemView("system-deliveries", DeliveriesHubPage);
