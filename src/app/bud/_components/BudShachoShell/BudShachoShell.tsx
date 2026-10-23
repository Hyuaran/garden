"use client";
import { createBrowserClient } from "@/app/_lib/supabase/browser";
import FontSizeButton from "@/app/system/_components/FontSizeButton";
import { HeaderViewProvider, HeaderViewSlot } from "@/app/system/_components/HeaderViewToggle";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type CSSProperties, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { MODULE_META, ModuleIcon, RailIcon } from "@/app/_components/ModuleIcon/ModuleIcon";
import { CLARITY_MASK } from "@/app/_lib/clarity-mask";
import { GARDEN_SHELL_MODULES } from "@/app/_components/layout/GardenShell/garden-shell-config";
import { getVisibleModules } from "@/app/_lib/module-visibility";
import { useTheme } from "@/app/_lib/theme/ThemeProvider";
import { NoticeBell } from "@/app/_components/notices/NoticeBell";
import { BUD_GARDEN_PAGE_MENU } from "../bud-garden-menu";
import { MenuIcon } from "@/app/system/_components/ShachoShell/ShachoShell";
import { resolveBudActivePath, budMenuIcon } from "./bud-navigation";
import { useBudState } from "../../_state/BudStateContext";
import { formatBudRoleLabel } from "../BudFaithfulFrame";
import systemStyles from "@/app/system/_components/ShachoShell/shacho-shell.module.css";
import styles from "./BudShachoShell.module.css";


export function BudShachoShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { gardenRole, sessionUser: sessionUser, signOut, budRole } = useBudState();
  const { theme, toggleTheme } = useTheme();
  const drawerId = useId();
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);


  const [broadbandAccess, setBroadbandAccess] = useState<{userId: string; allowed: boolean} | null>(null);
  const broadbandUserId = sessionUser?.user_id;
  useEffect(() => {
    let cancelled = false;
    setBroadbandAccess(null);
    if (broadbandUserId) {
      void (async () => {
        try {
          const result = await createBrowserClient().rpc("bud_bb_can_view");
          if (!cancelled) setBroadbandAccess({userId: broadbandUserId, allowed: !result.error && result.data === true});
        } catch { if (!cancelled) setBroadbandAccess(null); }
      })();
    }
    return () => { cancelled = true; };
  }, [broadbandUserId]);
  const canViewBroadband = !!broadbandUserId && broadbandAccess?.userId === broadbandUserId && broadbandAccess.allowed;
  const activePath = resolveBudActivePath(pathname);
  const visibleModules = new Set(getVisibleModules(gardenRole ?? "guest").map((module) => module.toLowerCase()));
  const themeLabel = theme === "dark" ? "ライトにする" : "ダークにする";
  const userName = sessionUser?.name ?? "";
  const renderModuleRail = () => (
    <>
      <Link href="/system" className={systemStyles.app} style={{ "--c": "#0ea5a0" } as CSSProperties} aria-label="System：社内システム">
        <RailIcon color="#0ea5a0" shade="#054e4b" iconScale={1.85} iconStrokeWidth={1.9}>
          <path d="M4 11h9v6.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M13 13.5l5.5-3.8M18.5 9.7l2.2 1.1M6.5 11V9.2A2.2 2.2 0 0 1 8.7 7h1.6M20 13.8v2.2M17.6 15.2V17" />
        </RailIcon>
        <span className={systemStyles.railTip}><b>System</b><span>社内システム</span></span>
      </Link>
      <div className={systemStyles.separator} />
      {GARDEN_SHELL_MODULES.filter((module) => visibleModules.has(module.id)).map((module) => {
        const current = module.id === "bud";
        return (
          <Link
            key={module.id}
            href={`/${module.id}`}
            className={`${systemStyles.app} ${current ? systemStyles.current : ""}`}
            style={{ "--c": MODULE_META[module.id].color } as CSSProperties}
            aria-current={current ? "page" : undefined}
            aria-label={`${module.name}：${MODULE_META[module.id].role}`}
          >
            <ModuleIcon id={module.id} />
            <span className={systemStyles.railTip}><b>{module.name}</b><span>{MODULE_META[module.id].role}</span></span>
          </Link>
        );
      })}
    </>
  );
  const renderBudMenu = () => (
    <nav className={systemStyles.nav} aria-label="Budメニュー" onClick={(event) => {
      if ((event.target as HTMLElement).closest("a")) setDrawerOpen(false);
    }}>
      <div className={styles.navLabel}>メニュー</div>
      {BUD_GARDEN_PAGE_MENU.filter(menu => menu.href !== "/bud/profit/broadband" || canViewBroadband).map((menu) => menu.divider
        ? <hr key={menu.href} className={styles.divider} />
        : <Link key={menu.href} href={menu.href} className={activePath === menu.href ? systemStyles.active : undefined} aria-current={activePath === menu.href ? "page" : undefined}>
            <MenuIcon icon={budMenuIcon(menu.href)} /><span>{menu.label}</span>
          </Link>)} 
    </nav>
  );

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      openButtonRef.current?.focus();
    };
  }, [drawerOpen]);

  if (pathname === "/bud/login") return <>{children}</>;

  return (
    <HeaderViewProvider><div className={`${systemStyles.shell} ${systemStyles.hasSidebar} ${styles.shell}`}>
      <aside className={systemStyles.rail} aria-label="Gardenシリーズ">
        <div className={systemStyles.railInner}>
          {renderModuleRail()}
        </div>
      </aside>

      <aside className={systemStyles.side}>
        <div className={systemStyles.sideInner}>
          <div className={systemStyles.brand}>
            <Link href="/" className={systemStyles.brandName} aria-label="Garden ホームへ">
              <Image className={systemStyles.brandMark} src="/themes/garden-shell/images/login/mark-tree-emblem.png" width={256} height={256} alt="" unoptimized />
              <span>Garden</span>
            </Link>
            <div className={systemStyles.moduleName}>Bud ／ 経理・収支</div>
          </div>

          {renderBudMenu()}

          {sessionUser && gardenRole && (
            <div className={systemStyles.who} {...CLARITY_MASK}>
              <div className={systemStyles.avatar}>{sessionUser.name.charAt(0)}</div>
              <div>
                <div className={systemStyles.userName}>{sessionUser.name}</div>
                <div className={systemStyles.userRole}><span>{formatBudRoleLabel(budRole)}</span></div>
              </div>
            </div>
          )}
        </div>
      </aside>
      <header className={systemStyles.mobileTopbar}>
        <button ref={openButtonRef} className={systemStyles.menuButton} type="button" aria-label="メニューを開く" aria-expanded={drawerOpen} aria-controls={drawerId} onClick={() => setDrawerOpen(true)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg></button>
        <Link href="/" className={systemStyles.mobileBrand} aria-label="Garden ホームへ（上部）"><Image className={systemStyles.mobileBrandMark} src="/themes/garden-shell/images/login/mark-tree-emblem.png" width={256} height={256} alt="" unoptimized /><span>Garden ／ Bud</span></Link>
        <div className={systemStyles.mobileActions}>
          <HeaderViewSlot mobile /><NoticeBell className={systemStyles.iconButton} /><FontSizeButton className={systemStyles.iconButton} tipClassName={systemStyles.actionTip} />
          <button className={systemStyles.iconButton} type="button" aria-label="テーマを切り替える" onClick={toggleTheme}>
            {theme === "dark" ? <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.2 5.2l1.9 1.9M16.9 16.9l1.9 1.9M18.8 5.2l-1.9 1.9M7.1 16.9l-1.9 1.9" /></svg> : <svg viewBox="0 0 24 24"><path d="M20 14.4A8.4 8.4 0 0 1 9.6 4 8.4 8.4 0 1 0 20 14.4z" /></svg>}
          </button>
          <button className={systemStyles.iconButton} type="button" aria-label="ログアウトする" onClick={() => void signOut()}>
            <svg viewBox="0 0 24 24"><path d="M15 17l5-5-5-5M20 12H9M12 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6" /></svg>
          </button>
        </div>
      </header>
      {drawerOpen && <div className={`${systemStyles.drawerLayer} ${systemStyles.drawerOpen}`}>
        <aside id={drawerId} className={systemStyles.drawer} role="dialog" aria-modal="true" aria-label="Budメニュー">
          <div className={systemStyles.drawerHead}>
            <Link href="/" className={systemStyles.brandName} aria-label="Garden ホームへ">
              <Image className={systemStyles.brandMark} src="/themes/garden-shell/images/login/mark-tree-emblem.png" width={256} height={256} alt="" unoptimized />
              <span>Garden</span>
            </Link>
            <button ref={closeButtonRef} className={systemStyles.drawerClose} type="button" aria-label="閉じる" onClick={() => setDrawerOpen(false)}>×</button>
          </div>
          <div className={systemStyles.moduleName}>Bud ／ 経理・収支</div>
          <div className={systemStyles.drawerRail} aria-label="Gardenシリーズ">{renderModuleRail()}</div>
          {renderBudMenu()}
          {sessionUser && gardenRole && (
            <div className={systemStyles.who} {...CLARITY_MASK}>
              <div className={systemStyles.avatar}>{sessionUser.name.charAt(0)}</div>
              <div>
                <div className={systemStyles.userName}>{sessionUser.name}</div>
                <div className={systemStyles.userRole}><span>{formatBudRoleLabel(budRole)}</span></div>
              </div>
            </div>
          )}
        </aside>
        <button className={systemStyles.drawerBackdrop} type="button" aria-label="メニューを閉じる" onClick={() => setDrawerOpen(false)} />
      </div>}

      <main className={`${systemStyles.main} ${styles.main}`}>
        <div className={styles.topbar}><div className={styles.actions}>
          {userName && <span className={systemStyles.accountName} {...CLARITY_MASK}>{userName}さん</span>}
          <HeaderViewSlot /><NoticeBell className={systemStyles.iconButton} /><FontSizeButton className={systemStyles.iconButton} tipClassName={systemStyles.actionTip} />
          <button className={systemStyles.iconButton} type="button" aria-label={themeLabel} onClick={toggleTheme}>
            {theme === "dark" ? <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.2 5.2l1.9 1.9M16.9 16.9l1.9 1.9M18.8 5.2l-1.9 1.9M7.1 16.9l-1.9 1.9" /></svg> : <svg viewBox="0 0 24 24"><path d="M20 14.4A8.4 8.4 0 0 1 9.6 4 8.4 8.4 0 1 0 20 14.4z" /></svg>}
            <span className={systemStyles.actionTip}>{themeLabel}</span>
          </button>
          <button className={systemStyles.iconButton} type="button" aria-label="ログアウト" onClick={() => void signOut()}>
            <svg viewBox="0 0 24 24"><path d="M15 17l5-5-5-5M20 12H9M12 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6" /></svg>
            <span className={systemStyles.actionTip}>ログアウト</span>
          </button>
        </div>
        </div>
        <div className={styles.content}>
          {children}
        </div>

      </main>
    </div></HeaderViewProvider>
  );
}
