import { visibleManuals } from "@/lib/auth/manual-view.server";
import { withSystemView } from "@/lib/auth/system-view-page.server";
import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@/app/_lib/supabase/server";
import { GARDEN_ROLE_ORDER, type GardenRole } from "@/app/root/_constants/types";
import { isEmployeeActive } from "@/lib/auth/employee-access";
import { findManualModule } from "../_lib/manuals-registry";

export async function generateMetadata({ params }: { params: Promise<{ module: string }> }) {
  const { module: moduleSlug } = await params;
  const manualModule = findManualModule(moduleSlug);
  return { title: `${manualModule?.name ?? "マニュアル"} | Garden` };
}

async function ModuleManualsPage({ params }: { params: Promise<{ module: string }> }) {
  const { module: moduleSlug } = await params;
  const manualModule = findManualModule(moduleSlug);
  if (!manualModule) notFound();

  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?returnTo=%2Fsystem%2Fmanuals%2F${encodeURIComponent(moduleSlug)}`);

  const { data: employee } = await supabase
    .from("root_employees")
    .select("garden_role,is_active,termination_date,deleted_at")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (!employee || !isEmployeeActive(employee)) redirect(`/login?returnTo=%2Fsystem%2Fmanuals%2F${encodeURIComponent(moduleSlug)}`);

  const role = GARDEN_ROLE_ORDER.includes(employee.garden_role as GardenRole)
    ? employee.garden_role as GardenRole
    : "staff";
  const manuals = (await visibleManuals(role))
    .filter((manual) => manual.moduleSlug === moduleSlug)
    ;

  if (!manuals.length) notFound();

  return redirect(`/system/manuals?tab=${encodeURIComponent(moduleSlug)}`);
}

export default withSystemView("system-manuals", ModuleManualsPage);
