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

export default async function ListMasterPage() {
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
  if (!isRoleAtLeast(role, "manager")) {
    return <div className={styles.pageShell}>
      <header className={styles.header}>
        <SystemBreadcrumb items={[{ label: "リストマスタ" }]} />
        <h1>リストマスタ</h1>
      </header>
      <section className={styles.notice}>
        <h2>この画面は責任者以上が使えます</h2>
        <p>必要な場合は責任者に確認してください。</p>
      </section>
    </div>;
  }

  return <ListMasterClient />;
}
