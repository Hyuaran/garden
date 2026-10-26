import { withSystemView } from "@/lib/auth/system-view-page.server";
import { redirect } from "next/navigation";
import { createServerClient } from "@/app/_lib/supabase/server";
import { isRoleAtLeast, type GardenRole } from "@/app/root/_constants/types";
import { isEmployeeActive } from "@/lib/auth/employee-access";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import { ListMasterClient } from "./_components/ListMasterClient";
import styles from "./_components/list-master.module.css";

export const metadata = {
  title: "リストマスタ | Garden",
};

async function ListMasterPage() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?returnTo=%2Fsystem%2Flist");

  const { data: employee } = await supabase
    .from("root_employees")
    .select("garden_role,is_active,termination_date,deleted_at")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (!employee || !isEmployeeActive(employee)) redirect("/login?returnTo=%2Fsystem%2Flist");

  const role = String(employee.garden_role ?? "staff") as GardenRole;


  return <ListMasterClient canSyncCalls={isRoleAtLeast(role, "manager")} />;
}

export default withSystemView("system-list", ListMasterPage);
