import { redirect } from "next/navigation";
import { createServerClient } from "@/app/_lib/supabase/server";
import { GARDEN_ROLE_ORDER, type GardenRole } from "@/app/root/_constants/types";
import FormsHubClient from "./FormsHubClient";
import { getVisibleSystemForms } from "./_lib/forms-registry";

export const metadata = { title: "フォーム | Garden" };

export default async function FormsHubPage() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?returnTo=%2Fsystem%2Fforms");

  const { data: employee } = await supabase
    .from("root_employees")
    .select("garden_role")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (!employee) redirect("/login?returnTo=%2Fsystem%2Fforms");

  const role = GARDEN_ROLE_ORDER.includes(employee.garden_role as GardenRole)
    ? employee.garden_role as GardenRole
    : "staff";

  return <FormsHubClient forms={getVisibleSystemForms(role)} />;
}
