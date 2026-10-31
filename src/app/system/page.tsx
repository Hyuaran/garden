import SystemTabs from "@/app/system/_components/SystemTabs/SystemTabs";
import { canView, canViewSystemMenu, viewPermissionContext } from "@/lib/auth/view-permission.server";
import { systemPageKey } from "@/lib/auth/system-view-scopes";
import { withSystemView } from "@/lib/auth/system-view-page.server";
import { SystemViewHeading } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/app/_lib/supabase/server";
import { GARDEN_ROLE_ORDER, type GardenRole } from "@/app/root/_constants/types";
import { isEmployeeActive } from "@/lib/auth/employee-access";
import { MenuIcon } from "./_components/ShachoShell/ShachoShell";
import SystemBreadcrumb from "./_components/SystemBreadcrumb/SystemBreadcrumb";
import { canUseSystemItem, SYSTEM_MENU_ITEMS } from "./_components/ShachoShell/shacho-shell-config";
import styles from "./system-home.module.css";
import { needsOnboarding } from "./onboarding/_lib/onboarding.server";

export const metadata = { title: "社内システム | Garden" };

async function SystemHomePage() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?returnTo=%2Fsystem");
  const { data: employee } = await supabase.from("root_employees").select("employee_id,garden_role,is_active,termination_date,deleted_at").eq("user_id", auth.user.id).eq("is_active", true).is("deleted_at", null).maybeSingle();
  if (!employee || !isEmployeeActive(employee)) redirect("/login?returnTo=%2Fsystem");
  const role = GARDEN_ROLE_ORDER.includes(employee.garden_role as GardenRole) ? employee.garden_role as GardenRole : "staff";
  const { viewer } = await viewPermissionContext();
  const menuAccess = await Promise.all(SYSTEM_MENU_ITEMS.map(item => item.href && systemPageKey(item.href) ? canViewSystemMenu(systemPageKey(item.href)!, viewer, canUseSystemItem(item, role)) : canUseSystemItem(item, role)));
  const visible = SYSTEM_MENU_ITEMS.filter((_, index) => menuAccess[index]);
  const showOnboarding = await canView("system-onboarding", "", viewer) && await needsOnboarding(supabase, employee.employee_id);
  return <>
    <header className={styles.header}><SystemBreadcrumb /><SystemViewHeading><h1>ホーム</h1></SystemViewHeading></header><SystemTabs />
    {showOnboarding && <section className={styles.onboardingNotice} aria-label="入社手続きのご案内"><p>入社手続きの入力がまだ終わっていません</p><Link href="/system/onboarding">入力する</Link></section>}
    <div className={styles.sectionTitle}>使えるもの</div>
    <div className={styles.grid}>{visible.filter((item) => item.href && item.href !== "/system").map((item) => <Link className={styles.card} href={item.href!} key={item.label}><div className={styles.cardHeader}><span className={styles.badge}><MenuIcon icon={item.icon}/></span><h2>{item.label}</h2></div><p>{item.description}</p><div className={styles.meta}>開く →</div></Link>)}</div>
    <div className={styles.sectionTitle}>これから増えるもの</div>
    <div className={styles.grid}>{visible.filter((item) => item.upcoming).map((item) => <div className={`${styles.card} ${styles.upcoming}`} key={item.label}><div className={styles.cardHeader}><span className={styles.badge}><MenuIcon icon={item.icon}/></span><h2>{item.label}</h2></div><p>{item.description}</p><div className={styles.meta}>準備中</div></div>)}</div>
  </>;
}

export default withSystemView("system-home", SystemHomePage);
