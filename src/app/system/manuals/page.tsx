import { readFile } from "node:fs/promises";
import path from "node:path";
import { isRoleAtLeast } from "@/app/root/_constants/types";
import { renderMarkdown } from "./_lib/render-markdown";
import { visibleManuals } from "@/lib/auth/manual-view.server";
import { withSystemView } from "@/lib/auth/system-view-page.server";
import { redirect } from "next/navigation";
import { createServerClient } from "@/app/_lib/supabase/server";
import { GARDEN_ROLE_ORDER, type GardenRole } from "@/app/root/_constants/types";
import { isEmployeeActive } from "@/lib/auth/employee-access";
import ManualsHubClient from "./ManualsHubClient";
import { MANUAL_MODULES } from "./_lib/manuals-registry";

export const metadata = { title: "マニュアル | Garden" };

async function ManualsHubPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
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

  const manuals = await visibleManuals(role);
  const modules = MANUAL_MODULES.map(module => ({ ...module, count: manuals.filter(manual => manual.moduleSlug === module.slug).length })).filter(module => module.count);
  const conceptHtml = isRoleAtLeast(role, "staff") ? renderMarkdown(await readFile(path.join(process.cwd(), "src/app/system/manuals/_content/garden-concept.md"), "utf8")) : "";
  return <ManualsHubClient modules={modules} manuals={manuals} conceptHtml={conceptHtml} selectedTab={(await searchParams).tab} />;
}

export default withSystemView("system-manuals", ManualsHubPage);
