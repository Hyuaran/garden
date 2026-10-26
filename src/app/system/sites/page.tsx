import { canView, viewPermissionContext } from "@/lib/auth/view-permission.server";
import { withSystemView } from "@/lib/auth/system-view-page.server";
import { redirect } from "next/navigation";
import { createServerClient } from "@/app/_lib/supabase/server";
import { GARDEN_ROLE_ORDER, type GardenRole, isRoleAtLeast } from "@/app/root/_constants/types";
import { isEmployeeActive } from "@/lib/auth/employee-access";
import SitesHubClient from "./SitesHubClient";
import { CORPORATE_SITES_DATA } from "./_lib/sites-data.server";

export const metadata = { title: "コーポレートサイト | Garden" };

async function CorporateSitesPage() {
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


  const { viewer } = await viewPermissionContext();
  const sitesAllowed = await canView("system-sites", "sites", viewer);
  const data = sitesAllowed ? CORPORATE_SITES_DATA : { as_of: "", common: { hosting: "", dns_policy: "", form: "" }, excluded: [], google_maps: [],
    sites: CORPORATE_SITES_DATA.sites.filter(site => site.company_id).map(site => ({ company_id: site.company_id, company: site.company, kind: "", status: site.status })) };
  return <SitesHubClient data={data} role={role} />;
}

export default withSystemView("system-sites", CorporateSitesPage);
