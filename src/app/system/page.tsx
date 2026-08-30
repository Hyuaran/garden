import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/app/_lib/supabase/server";
import { GARDEN_ROLE_ORDER, type GardenRole } from "@/app/root/_constants/types";
import ShachoShell, { MenuIcon } from "./_components/ShachoShell/ShachoShell";
import { canUseSystemItem, SYSTEM_MENU_ITEMS } from "./_components/ShachoShell/shacho-shell-config";
import styles from "./system-home.module.css";

export const metadata = { title: "社内システム | Garden" };

export default async function SystemHomePage() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?returnTo=%2Fsystem");
  const { data: employee } = await supabase.from("root_employees").select("name,garden_role,company_id").eq("user_id", auth.user.id).eq("is_active", true).is("deleted_at", null).maybeSingle();
  if (!employee) redirect("/login?returnTo=%2Fsystem");
  const role = GARDEN_ROLE_ORDER.includes(employee.garden_role as GardenRole) ? employee.garden_role as GardenRole : "staff";
  const { data: company } = await supabase.from("root_companies").select("company_name").eq("company_id", employee.company_id).maybeSingle();
  const visible = SYSTEM_MENU_ITEMS.filter((item) => canUseSystemItem(item, role));
  return <ShachoShell activePath="/system" user={{ name: String(employee.name), company: String(company?.company_name ?? "所属会社未登録"), role }}>
    <header className={styles.header}><div className={styles.eyebrow}>System</div><h1>社内システム</h1></header>
    <p className={styles.lead}>日々の事務作業をまとめた入口です。使いたいものを選んでください。</p>
    <div className={styles.sectionTitle}>使えるもの</div>
    <div className={styles.grid}>{visible.filter((item) => item.href && item.href !== "/system").map((item) => <Link className={styles.card} href={item.href!} key={item.label}><div className={styles.cardHeader}><span className={styles.badge}><MenuIcon icon={item.icon}/></span><h2>{item.label}</h2></div><p>{item.description}</p><div className={styles.meta}>開く →</div></Link>)}</div>
    <div className={styles.sectionTitle}>これから増えるもの</div>
    <div className={styles.grid}>{visible.filter((item) => item.upcoming).map((item) => <div className={`${styles.card} ${styles.upcoming}`} key={item.label}><div className={styles.cardHeader}><span className={styles.badge}><MenuIcon icon={item.icon}/></span><h2>{item.label}</h2></div><p>{item.description}</p><div className={styles.meta}>準備中</div></div>)}</div>
  </ShachoShell>;
}
