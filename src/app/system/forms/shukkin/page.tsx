import { redirect } from "next/navigation";
import { isRoleAtLeast, type GardenRole } from "@/app/root/_constants/types";
import { createServerClient } from "@/app/_lib/supabase/server";
import { isEmployeeActive } from "@/lib/auth/employee-access";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import ShukkinClient from "./ShukkinClient";
import styles from "./shukkin.module.css";

export const metadata = { title: "出勤表・シフトLINE連絡テキスト生成 | Garden" };

export default async function ShukkinPage() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?returnTo=%2Fsystem%2Fforms%2Fshukkin");
  const { data: employee } = await supabase
    .from("root_employees")
    .select("name,garden_role,is_active,termination_date,deleted_at")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (!employee || !isEmployeeActive(employee)) redirect("/login?returnTo=%2Fsystem%2Fforms%2Fshukkin");

  const role = String(employee.garden_role ?? "staff") as GardenRole;
  if (!isRoleAtLeast(role, "staff")) {
    return <div className={styles.pageShell}>
      <header className={styles.header}>
        <SystemBreadcrumb items={[{ label: "フォーム", href: "/system/forms" }, { label: "出勤表・シフトLINE連絡テキスト生成" }]} />
        <h1>出勤表・シフトLINE連絡テキスト生成</h1>
      </header>
      <section className={styles.panel}>
        <h2>この画面は社員以上が使えます</h2>
        <p>必要な場合は責任者に確認してください。</p>
      </section>
    </div>;
  }

  return <ShukkinClient canEditMembers={isRoleAtLeast(role, "manager")} />;
}
