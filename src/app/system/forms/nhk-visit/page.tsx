import { withSystemView } from "@/lib/auth/system-view-page.server";
import { redirect } from "next/navigation";
import { isRoleAtLeast, type GardenRole } from "@/app/root/_constants/types";
import { createServerClient } from "@/app/_lib/supabase/server";
import { isEmployeeActive } from "@/lib/auth/employee-access";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import NhkVisitClient from "./NhkVisitClient";
import styles from "./nhk-visit.module.css";

export const metadata = { title: "NHK訪問業務 報告フォーム | Garden" };

async function NhkVisitPage() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?returnTo=%2Fsystem%2Fforms%2Fnhk-visit");
  const { data: employee } = await supabase
    .from("root_employees")
    .select("name,employee_number,garden_role,is_active,termination_date,deleted_at")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (!employee || !isEmployeeActive(employee)) redirect("/login?returnTo=%2Fsystem%2Fforms%2Fnhk-visit");

  const role = String(employee.garden_role ?? "staff") as GardenRole;


  return <NhkVisitClient submitterName={String(employee.name)} employeeNumber={String(employee.employee_number)} />;
}

export default withSystemView("system-forms", NhkVisitPage, "input");
