"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type CSSProperties, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { MODULE_META, ModuleIcon, RailIcon } from "@/app/_components/ModuleIcon/ModuleIcon";
import { GARDEN_SHELL_MODULES } from "@/app/_components/layout/GardenShell/garden-shell-config";
import { getVisibleModules } from "@/app/_lib/module-visibility";
import { useTheme } from "@/app/_lib/theme/ThemeProvider";
import { GARDEN_ROLE_LABELS, MASTER_MENUS, type RootMenuIconName } from "../_constants/types";
import { SessionWarningModal } from "./SessionWarningModal";
import { useRootState } from "../_state/RootStateContext";
import { RootMenuIcon } from "./RootMenuIcon";
import systemStyles from "@/app/system/_components/ShachoShell/shacho-shell.module.css";
import rootStyles from "./root-shell.module.css";

const HOME_MENU = {
  slug: "",
  title: "ホーム",
  icon: "home" as RootMenuIconName,
  href: "/root",
};

export function RootShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { canWrite, gardenRole, rootUser, signOut } = useRootState();
  const { theme, toggleTheme } = useTheme();
  const drawerId = useId();
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (pathname === "/root/login") {
    return <>{children}</>;
  }

  const menus = MASTER_MENUS.filter((m) => !m.adminOnly || canWrite);
  const visibleModules = new Set(getVisibleModules(gardenRole).map((module) => module.toLowerCase()));
  const themeLabel = theme === "dark" ? "ライトにする" : "ダークにする";
  const userName = rootUser?.name ?? "";
  const affiliation = rootUser?.company_name || "所属会社未登録";
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
        const current = module.id === "root";
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
  const renderRootMenu = () => (
    <nav className={systemStyles.nav} aria-label="Rootメニュー" onClick={(event) => {
      if ((event.target as HTMLElement).closest("a")) setDrawerOpen(false);
    }}>
      <div className={rootStyles.navLabel}>メニュー</div>
      <Link
        href={HOME_MENU.href}
        className={pathname === "/root" ? systemStyles.active : undefined}
        aria-current={pathname === "/root" ? "page" : undefined}
      >
        <RootMenuIcon icon={HOME_MENU.icon} />
        {HOME_MENU.title}
      </Link>
      {menus.map((menu) => {
        const href = `/root/${menu.slug}`;
        const active = pathname === href || pathname?.startsWith(href + "/");
        return (
          <Link
            key={menu.slug}
            href={href}
            className={active ? systemStyles.active : undefined}
            aria-current={active ? "page" : undefined}
          >
            <RootMenuIcon icon={menu.icon} />
            <span>{menu.title}</span>
          </Link>
        );
      })}
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

  return (
    <div className={`${systemStyles.shell} ${systemStyles.hasSidebar} ${rootStyles.shell}`}>
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
            <div className={systemStyles.moduleName}>Root ／ 組織台帳</div>
          </div>

          {renderRootMenu()}

          {rootUser && gardenRole && (
            <div className={systemStyles.who}>
              <div className={systemStyles.avatar}>{rootUser.name.charAt(0)}</div>
              <div>
                <div className={systemStyles.userName}>{rootUser.name}</div>
                <div className={systemStyles.userRole}><span>{affiliation}</span><span>{GARDEN_ROLE_LABELS[gardenRole]}</span></div>
              </div>
            </div>
          )}
        </div>
      </aside>
      <header className={systemStyles.mobileTopbar}>
        <button ref={openButtonRef} className={systemStyles.menuButton} type="button" aria-label="メニューを開く" aria-expanded={drawerOpen} aria-controls={drawerId} onClick={() => setDrawerOpen(true)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg></button>
        <Link href="/" className={systemStyles.mobileBrand} aria-label="Garden ホームへ（上部）"><Image className={systemStyles.mobileBrandMark} src="/themes/garden-shell/images/login/mark-tree-emblem.png" width={256} height={256} alt="" unoptimized /><span>Garden ／ Root</span></Link>
        <div className={systemStyles.mobileActions}>
          <button className={systemStyles.iconButton} type="button" aria-label="テーマを切り替える" onClick={toggleTheme}>
            {theme === "dark" ? <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.2 5.2l1.9 1.9M16.9 16.9l1.9 1.9M18.8 5.2l-1.9 1.9M7.1 16.9l-1.9 1.9" /></svg> : <svg viewBox="0 0 24 24"><path d="M20 14.4A8.4 8.4 0 0 1 9.6 4 8.4 8.4 0 1 0 20 14.4z" /></svg>}
          </button>
          <button className={systemStyles.iconButton} type="button" aria-label="ログアウトする" onClick={() => void signOut("manual")}>
            <svg viewBox="0 0 24 24"><path d="M15 17l5-5-5-5M20 12H9M12 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6" /></svg>
          </button>
        </div>
      </header>
      {drawerOpen && <div className={`${systemStyles.drawerLayer} ${systemStyles.drawerOpen}`}>
        <aside id={drawerId} className={systemStyles.drawer} role="dialog" aria-modal="true" aria-label="Rootメニュー">
          <div className={systemStyles.drawerHead}>
            <Link href="/" className={systemStyles.brandName} aria-label="Garden ホームへ">
              <Image className={systemStyles.brandMark} src="/themes/garden-shell/images/login/mark-tree-emblem.png" width={256} height={256} alt="" unoptimized />
              <span>Garden</span>
            </Link>
            <button ref={closeButtonRef} className={systemStyles.drawerClose} type="button" aria-label="閉じる" onClick={() => setDrawerOpen(false)}>×</button>
          </div>
          <div className={systemStyles.moduleName}>Root ／ 組織台帳</div>
          <div className={systemStyles.drawerRail} aria-label="Gardenシリーズ">{renderModuleRail()}</div>
          {renderRootMenu()}
          {rootUser && gardenRole && (
            <div className={systemStyles.who}>
              <div className={systemStyles.avatar}>{rootUser.name.charAt(0)}</div>
              <div>
                <div className={systemStyles.userName}>{rootUser.name}</div>
                <div className={systemStyles.userRole}><span>{affiliation}</span><span>{GARDEN_ROLE_LABELS[gardenRole]}</span></div>
              </div>
            </div>
          )}
        </aside>
        <button className={systemStyles.drawerBackdrop} type="button" aria-label="メニューを閉じる" onClick={() => setDrawerOpen(false)} />
      </div>}

      <main className={`${systemStyles.main} ${rootStyles.main}`}>
        <div className={systemStyles.actions}>
          {userName && <span className={systemStyles.accountName}>{userName}さん</span>}
          <button className={systemStyles.iconButton} type="button" aria-label={themeLabel} onClick={toggleTheme}>
            {theme === "dark" ? <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.2 5.2l1.9 1.9M16.9 16.9l1.9 1.9M18.8 5.2l-1.9 1.9M7.1 16.9l-1.9 1.9" /></svg> : <svg viewBox="0 0 24 24"><path d="M20 14.4A8.4 8.4 0 0 1 9.6 4 8.4 8.4 0 1 0 20 14.4z" /></svg>}
            <span className={systemStyles.actionTip}>{themeLabel}</span>
          </button>
          <button className={systemStyles.iconButton} type="button" aria-label="ログアウト" onClick={() => void signOut("manual")}>
            <svg viewBox="0 0 24 24"><path d="M15 17l5-5-5-5M20 12H9M12 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6" /></svg>
            <span className={systemStyles.actionTip}>ログアウト</span>
          </button>
        </div>
        <div className={rootStyles.content}>
          {children}
        </div>
        <SessionWarningModal />
      </main>
    </div>
  );
}
