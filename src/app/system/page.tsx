import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/app/_lib/supabase/server";
import { GARDEN_ROLE_ORDER, type GardenRole } from "@/app/root/_constants/types";
import { MenuIcon } from "./_components/ShachoShell/ShachoShell";
import { canUseSystemItem, SYSTEM_MENU_ITEMS } from "./_components/ShachoShell/shacho-shell-config";
import styles from "./system-home.module.css";
import { needsOnboarding } from "./onboarding/_lib/onboarding.server";

export const metadata = { title: "社内システム | Garden" };

export default async function SystemHomePage() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?returnTo=%2Fsystem");
  const { data: employee } = await supabase.from("root_employees").select("employee_id,garden_role").eq("user_id", auth.user.id).eq("is_active", true).is("deleted_at", null).maybeSingle();
  if (!employee) redirect("/login?returnTo=%2Fsystem");
  const role = GARDEN_ROLE_ORDER.includes(employee.garden_role as GardenRole) ? employee.garden_role as GardenRole : "staff";
  const visible = SYSTEM_MENU_ITEMS.filter((item) => canUseSystemItem(item, role));
  const showOnboarding = await needsOnboarding(supabase, employee.employee_id);
  return <>
    <header className={styles.header}><div className={styles.eyebrow}>System</div><h1>社内システム</h1></header>
    {showOnboarding && <section className={styles.onboardingNotice} aria-label="入社手続きのご案内"><p>入社手続きの入力がまだ終わっていません</p><Link href="/system/onboarding">入力する</Link></section>}
    <p className={styles.lead}>日々の事務作業をまとめた入口です。使いたいものを選んでください。</p>
    <div className={styles.sectionTitle}>使えるもの</div>
    <div className={styles.grid}>{visible.filter((item) => item.href && item.href !== "/system").map((item) => <Link className={styles.card} href={item.href!} key={item.label}><div className={styles.cardHeader}><span className={styles.badge}><MenuIcon icon={item.icon}/></span><h2>{item.label}</h2></div><p>{item.description}</p><div className={styles.meta}>開く →</div></Link>)}</div>
    <div className={styles.sectionTitle}>これから増えるもの</div>
    <div className={styles.grid}>{visible.filter((item) => item.upcoming).map((item) => <div className={`${styles.card} ${styles.upcoming}`} key={item.label}><div className={styles.cardHeader}><span className={styles.badge}><MenuIcon icon={item.icon}/></span><h2>{item.label}</h2></div><p>{item.description}</p><div className={styles.meta}>準備中</div></div>)}</div>
  </>;
}
