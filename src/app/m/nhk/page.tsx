import { redirect } from "next/navigation";
import { isRoleAtLeast, type GardenRole } from "@/app/root/_constants/types";
import { createServerClient } from "@/app/_lib/supabase/server";
import { isEmployeeActive } from "@/lib/auth/employee-access";
import NhkVisitClient from "@/app/system/forms/nhk-visit/NhkVisitClient";
import styles from "@/app/system/forms/nhk-visit/nhk-visit.module.css";

export const metadata = { title: "NHK訪問業務 報告 | Garden" };

export default async function MobileNhkVisitPage() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?returnTo=%2Fm%2Fnhk");

  const { data: employee } = await supabase
    .from("root_employees")
    .select("name,employee_number,garden_role,is_active,termination_date,deleted_at")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (!employee || !isEmployeeActive(employee)) redirect("/login?returnTo=%2Fm%2Fnhk");

  const role = String(employee.garden_role ?? "staff") as GardenRole;
  if (!isRoleAtLeast(role, "staff")) {
    return (
      <main className={`${styles.pageShell} ${styles.mobile}`}>
        <section className={styles.panel}>
          <h2>この画面は社員以上が使えます</h2>
          <p>必要な場合は責任者に確認してください。</p>
        </section>
      </main>
    );
  }

  return <NhkVisitClient submitterName={String(employee.name)} employeeNumber={String(employee.employee_number)} mobile />;
}
