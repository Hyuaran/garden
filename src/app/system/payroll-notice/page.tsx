import { redirect } from "next/navigation";
import { isRoleAtLeast, type GardenRole } from "@/app/root/_constants/types";
import { createServerClient } from "@/app/_lib/supabase/server";
import PayrollNoticeClient from "./PayrollNoticeClient";
import styles from "./payroll-notice.module.css";

export const metadata = { title: "給与計算連絡 | Garden" };

export default async function PayrollNoticePage() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?returnTo=%2Fsystem%2Fpayroll-notice");
  const { data: employee } = await supabase
    .from("root_employees")
    .select("name,garden_role")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (!employee) redirect("/login?returnTo=%2Fsystem%2Fpayroll-notice");

  const role = String(employee.garden_role ?? "staff") as GardenRole;
  if (!isRoleAtLeast(role, "staff")) {
    return <div className={styles.pageShell}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>System / 給与計算連絡</p>
        <h1>給与計算に関する連絡</h1>
      </header>
      <section className={styles.notice}>
        <h2>この画面は社員以上が使えます</h2>
        <p>必要な場合は責任者に確認してください。</p>
      </section>
    </div>;
  }

  return <PayrollNoticeClient submitterName={String(employee.name)} canViewHistory={isRoleAtLeast(role, "manager")} />;
}
