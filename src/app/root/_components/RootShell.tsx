"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GARDEN_ROLE_LABELS, MASTER_MENUS, type RootMenuIconName } from "../_constants/types";
import { SessionWarningModal } from "./SessionWarningModal";
import { useRootState } from "../_state/RootStateContext";
import { RootMenuIcon } from "./RootMenuIcon";
import systemStyles from "@/app/system/_components/ShachoShell/shacho-shell.module.css";
import rootStyles from "./root-shell.module.css";
import type { ReactNode } from "react";
import { ModuleShell } from "@/app/_components/layout/GardenShell/ModuleShell";
const HOME_MENU = {
  slug: "",
  title: "ホーム",
  icon: "home" as RootMenuIconName,
  href: "/root",
};

export function RootShell({ children }: { children: ReactNode }) {
 const pathname = usePathname();
 const { canWrite, gardenRole, rootUser, signOut } = useRootState();
 if (pathname === "/root/login") return <>{children}</>;
 const menus = MASTER_MENUS.filter((m) => !m.adminOnly || canWrite);
 return <ModuleShell moduleId="root" moduleName="Root" moduleLabel="Root ／ 組織台帳" gardenRole={gardenRole}
 userName={rootUser?.name} affiliation={rootUser?.company_name || "所属会社未登録"} roleLabel={gardenRole ? GARDEN_ROLE_LABELS[gardenRole] : ""}
 signOut={() => signOut("manual")} footer={<SessionWarningModal />} menu={<>      <div className={rootStyles.navLabel}>メニュー</div>
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
</>}>{children}</ModuleShell>;
}
