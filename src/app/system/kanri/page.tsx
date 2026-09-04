import { redirect } from "next/navigation";
import { createServerClient } from "@/app/_lib/supabase/server";
import { isRoleAtLeast, type GardenRole } from "@/app/root/_constants/types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { monthRange, tokyoToday } from "./_lib/kanri-core";
import KanriPortalClient, { type KanriRunView } from "./KanriPortalClient";
import styles from "./kanri.module.css";

export const metadata = { title: "管理表ポータル | Garden" };

export default async function KanriPortalPage() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?returnTo=%2Fsystem%2Fkanri");

  const { data: employee } = await supabase
    .from("root_employees")
    .select("name,garden_role")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (!employee) redirect("/login?returnTo=%2Fsystem%2Fkanri");

  const role = String(employee.garden_role ?? "staff") as GardenRole;
  if (!isRoleAtLeast(role, "manager")) {
    return <div className={styles.pageShell}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>System / 管理表ポータル</p>
        <h1>管理表ポータル</h1>
      </header>
      <section className={styles.notice}>
        <h2>この画面は責任者以上が使えます</h2>
        <p>必要な場合は責任者に確認してください。</p>
      </section>
    </div>;
  }

  const today = tokyoToday();
  const { yearMonth } = monthRange(today);
  const admin = getSupabaseAdmin();
  const [runsResult, settingResult, pointResult, teamResult] = await Promise.all([
    admin
      .from("system_kanri_run")
      .select("id,target_date,mode,creator_name,status,summary,warnings,started_at,finished_at,created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("system_kanri_month_setting")
      .select("year_month,holidays,updated_at")
      .eq("year_month", yearMonth)
      .maybeSingle(),
    admin
      .from("system_kanri_point_master")
      .select("product,sort_order,active")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    admin
      .from("system_kanri_team")
      .select("team,sort_order,active")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
  ]);

  return <KanriPortalClient
    creatorName={String(employee.name)}
    today={today}
    initialRuns={(runsResult.data ?? []) as KanriRunView[]}
    initialHolidays={(settingResult.data?.holidays ?? []) as string[]}
    initialProducts={(pointResult.data ?? []).map((item) => String(item.product))}
    initialTeams={(teamResult.data ?? []).map((item) => String(item.team))}
  />;
}
