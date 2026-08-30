"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type CSSProperties, type ReactNode } from "react";
import { createBrowserClient } from "@/app/_lib/supabase/browser";
import { useTheme } from "@/app/_lib/theme/ThemeProvider";
import { getVisibleModules } from "@/app/_lib/module-visibility";
import { GARDEN_SHELL_MODULES, type GardenModuleId } from "@/app/_components/layout/GardenShell/garden-shell-config";
import { GARDEN_ROLE_LABELS, type GardenRole } from "@/app/root/_constants/types";
import { canUseSystemItem, shouldHideSidebar, SYSTEM_MENU_ITEMS, type SystemIcon } from "./shacho-shell-config";
import styles from "./shacho-shell.module.css";

type Props = {
  children: ReactNode;
  user: { name: string; company: string; role: GardenRole };
};

const MODULE_META: Record<GardenModuleId, { color: string; role: string }> = {
  bloom: { color: "#f472b6", role: "案件KPI" }, fruit: { color: "#fb923c", role: "法人実態情報" },
  seed: { color: "#facc15", role: "新事業" }, forest: { color: "#34d399", role: "全法人決算" },
  bud: { color: "#c084fc", role: "経理・収支" }, leaf: { color: "#4ade80", role: "案件アプリ" },
  tree: { color: "#a78bfa", role: "架電" }, sprout: { color: "#86efac", role: "採用" },
  soil: { color: "#9aa7b8", role: "データベース" }, root: { color: "#5b9dff", role: "組織台帳" },
  rill: { color: "#38bdf8", role: "メッセージ" }, calendar: { color: "#60a5fa", role: "予定管理" },
};

function ModuleIcon({ id }: { id: GardenModuleId }) {
  const icons: Record<GardenModuleId, ReactNode> = {
    bloom: <><circle cx="12" cy="10" r="2.4"/><path d="M12 7.6c0-2 1-3.6 2.5-3.6S17 5.6 17 7.6c2 0 3.6 1 3.6 2.5S19 12.6 17 12.6c0 2-1 3.6-2.5 3.6S12 14.6 12 12.6c-2 0-3.6-1-3.6-2.5S9.9 7.6 12 7.6z"/><path d="M12 16v5"/></>,
    fruit: <><path d="M12 8c-3.5 0-6 2.6-6 6s2.5 7 6 7 6-3.4 6-7-2.5-6-6-6z"/><path d="M12 8V4"/><path d="M12 5c2-.5 3.5-2 3.5-2"/></>,
    seed: <><ellipse cx="12" cy="13" rx="5" ry="6.5"/><path d="M12 19c0-4 1.5-7 4-9"/></>,
    forest: <><path d="M6 20v-3M6 17l-3-3h6zM6 14L4 11h4zM18 20v-3M18 17l-3-3h6zM18 14l-2-3h4zM12 21v-5M12 16l-3.5-4h7z"/></>,
    bud: <><path d="M12 21v-7"/><path d="M12 14c-3 0-5-2.4-5-5.5S9 3 12 3s5 2.4 5 5.5S15 14 12 14z"/></>,
    leaf: <><path d="M5 19c0-8 5-13 14-14 1 9-4 15-12 15-1 0-2 0-2-1z"/><path d="M8 18c2-4 5-7 9-9"/></>,
    tree: <><path d="M12 21v-6M12 15l-5-4h10zM12 11L8 7h8zM12 7l-3-3h6z"/></>,
    sprout: <><path d="M12 21v-8"/><path d="M12 13c0-3 2.2-5 5-5 0 3-2.2 5-5 5z"/><path d="M12 15c0-2.6-2-4.5-4.5-4.5 0 2.6 2 4.5 4.5 4.5z"/></>,
    soil: <><path d="M3 8h18M3 13h18M3 18h18M7 8v10M17 8v10"/></>,
    root: <><path d="M12 3v9M12 12c-1.5 2-4 3-5 6M12 12c1.5 2 4 3 5 6M12 12v9"/></>,
    rill: <><path d="M3 8c3 0 3 2 6 2s3-2 6-2 3 2 6 2M3 13c3 0 3 2 6 2s3-2 6-2 3 2 6 2M3 18c3 0 3 2 6 2"/></>,
    calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{icons[id]}</svg>;
}

export function MenuIcon({ icon }: { icon: SystemIcon }) {
  const icons: Record<SystemIcon, ReactNode> = {
    home: <path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>,
    person: <><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></>,
    shift: <><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4M8 14l2 2 5-5"/></>,
    zenkaku: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7M14 3v5h5v3M9 13h4M9 17h2"/><circle cx="17" cy="16" r="3.5"/><path d="M19.5 18.5 22 21"/></>,
    chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>,
    document: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4"/></>,
    folder: <><path d="M4 7h9l3 3h4M4 7v11a1 1 0 0 0 1 1h15a1 1 0 0 0 1-1v-8M9 14h7"/></>,
    message: <path d="M4 4h16v12H7l-3 3z"/>, report: <><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/></>,
    salary: <path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>,
    portal: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  };
  return <svg className={styles.menuIcon} viewBox="0 0 24 24" aria-hidden="true">{icons[icon]}</svg>;
}

export function resolveSystemActivePath(pathname: string): string | null {
  const matches = SYSTEM_MENU_ITEMS
    .filter((item) => item.href?.startsWith("/system"))
    .sort((a, b) => (b.href?.length ?? 0) - (a.href?.length ?? 0));
  return matches.find((item) => {
    if (!item.href) return false;
    return pathname === item.href || (item.href !== "/system" && pathname.startsWith(`${item.href}/`));
  })?.href ?? null;
}

export default function ShachoShell({ children, user }: Props) {
  const pathname = usePathname();
  const activePath = resolveSystemActivePath(pathname);
  const { theme, toggleTheme } = useTheme();
  async function logout() {
    await createBrowserClient().auth.signOut();
    window.location.assign("/login");
  }
  const visible = SYSTEM_MENU_ITEMS.filter((item) => canUseSystemItem(item, user.role));
  const visibleModules = new Set(getVisibleModules(user.role).map((module) => module.toLowerCase()));
  const hideSidebar = shouldHideSidebar(user.role);
  const themeLabel = theme === "dark" ? "ライトにする" : "ダークにする";
  return <div className={styles.shell}>
    {!hideSidebar && <><aside className={styles.rail} aria-label="Gardenシリーズ">
      <div className={styles.railInner}>
        <Link href="/system" className={`${styles.app} ${styles.current}`} style={{ "--c": "#0ea5a0" } as CSSProperties} aria-label="System：社内システム">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11h9v6.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M13 13.5l5.5-3.8M18.5 9.7l2.2 1.1M6.5 11V9.2A2.2 2.2 0 0 1 8.7 7h1.6M20 14.4v1.4M17.6 15.6v1.2"/></svg>
          <span className={styles.railTip}><b>System</b><span>社内システム</span></span>
        </Link>
        <div className={styles.separator}/>
        {GARDEN_SHELL_MODULES.filter((module) => visibleModules.has(module.id)).map((module) => <Link key={module.id} href={`/${module.id}`} className={styles.app} style={{ "--c": MODULE_META[module.id].color } as CSSProperties} aria-label={`${module.name}：${MODULE_META[module.id].role}`}>
          <ModuleIcon id={module.id}/><span className={styles.railTip}><b>{module.name}</b><span>{MODULE_META[module.id].role}</span></span>
        </Link>)}
      </div>
    </aside>
    <aside className={styles.side}>
      <div className={styles.sideInner}>
        <div className={styles.brand}><Link href="/" className={styles.brandName} aria-label="Garden ホームへ"><Image className={styles.brandMark} src="/themes/garden-shell/images/login/mark-tree-emblem.png" width={256} height={256} alt="" unoptimized/><span>Garden</span></Link><div className={styles.moduleName}>System ／ 社内システム</div></div>
        <nav className={styles.nav} aria-label="Systemメニュー">
          <div className={styles.navLabel}>メニュー</div>
          {visible.filter((item) => !item.upcoming).map((item) => <Link key={item.label} href={item.href!} className={activePath === item.href ? styles.active : undefined} aria-current={activePath === item.href ? "page" : undefined}><MenuIcon icon={item.icon}/>{item.label}</Link>)}
          <div className={styles.navLabel}>これから</div>
          {visible.filter((item) => item.upcoming).map((item) => <span key={item.label} className={styles.soon}><MenuIcon icon={item.icon}/>{item.label}<span className={styles.tag}>準備中</span></span>)}
        </nav>
        <div className={styles.who}><div className={styles.avatar}>{user.name.charAt(0)}</div><div><div className={styles.userName}>{user.name}</div><div className={styles.userRole}>{user.company} ／ {GARDEN_ROLE_LABELS[user.role]}</div></div></div>
      </div>
    </aside></>}
    <main className={`${styles.main} ${hideSidebar ? styles.mainFull : ""}`}>
      <div className={styles.actions}>
        <span className={styles.accountName}>{user.name}さん</span>
        <button className={styles.iconButton} type="button" aria-label={themeLabel} onClick={toggleTheme}>{theme === "dark" ? <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.2 5.2l1.9 1.9M16.9 16.9l1.9 1.9M18.8 5.2l-1.9 1.9M7.1 16.9l-1.9 1.9"/></svg> : <svg viewBox="0 0 24 24"><path d="M20 14.4A8.4 8.4 0 0 1 9.6 4 8.4 8.4 0 1 0 20 14.4z"/></svg>}<span className={styles.actionTip}>{themeLabel}</span></button>
        <button className={styles.iconButton} type="button" aria-label="ログアウト" onClick={() => void logout()}><svg viewBox="0 0 24 24"><path d="M15 17l5-5-5-5M20 12H9M12 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6"/></svg><span className={styles.actionTip}>ログアウト</span></button>
      </div>
      {children}
    </main>
  </div>;
}
