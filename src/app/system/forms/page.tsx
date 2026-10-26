import { canView, viewPermissionContext } from "@/lib/auth/view-permission.server";
import { withSystemView } from "@/lib/auth/system-view-page.server";
import { redirect } from "next/navigation";
import { createServerClient } from "@/app/_lib/supabase/server";
import { GARDEN_ROLE_ORDER, type GardenRole } from "@/app/root/_constants/types";
import { isEmployeeActive } from "@/lib/auth/employee-access";
import FormsHubClient from "./FormsHubClient";
import { SYSTEM_FORMS, getVisibleSystemForms } from "./_lib/forms-registry";
import { GYOMU_TOOLS, getVisibleGyomuTools } from "./_lib/gyomu-tools-registry";

export const metadata = { title: "業務管理ツール | Garden" };

async function FormsHubPage() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?returnTo=%2Fsystem%2Fforms");

  const { data: employee } = await supabase
    .from("root_employees")
    .select("garden_role,is_active,termination_date,deleted_at")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (!employee || !isEmployeeActive(employee)) redirect("/login?returnTo=%2Fsystem%2Fforms");

  const role = GARDEN_ROLE_ORDER.includes(employee.garden_role as GardenRole)
    ? employee.garden_role as GardenRole
    : "staff";

  const { viewer } = await viewPermissionContext();
  const visibleForms = getVisibleSystemForms(role), visibleTools = getVisibleGyomuTools(role);
  const formAccess = await Promise.all(SYSTEM_FORMS.map(form => canView("system-forms", "input", viewer, visibleForms.includes(form))));
  const toolAccess = await Promise.all(GYOMU_TOOLS.map(tool => canView("system-forms", tool.group, viewer, visibleTools.includes(tool))));
  return <FormsHubClient forms={SYSTEM_FORMS.filter((_, i) => formAccess[i])} tools={GYOMU_TOOLS.filter((_, i) => toolAccess[i])} />;
}

export default withSystemView("system-forms", FormsHubPage);
