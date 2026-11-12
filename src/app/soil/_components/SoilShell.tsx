"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ModuleShell } from "@/app/_components/layout/GardenShell/ModuleShell";
import { createBrowserClient } from "@/app/_lib/supabase/browser";
import { GARDEN_ROLE_LABELS, type GardenRole } from "@/app/root/_constants/types";
import { RootMenuIcon } from "@/app/root/_components/RootMenuIcon";
import styles from "@/app/system/_components/ShachoShell/shacho-shell.module.css";
import rootStyles from "@/app/root/_components/root-shell.module.css";
import { visibleSoilMenus } from "../_constants/menus";

export function SoilShell({ children, viewAccess, user }: {
  children: ReactNode;
  viewAccess: Record<string, boolean>;
  user: { name: string; company: string; role: GardenRole };
}) {
  const pathname = usePathname();
  const router = useRouter();
  async function signOut() {
    const { error } = await createBrowserClient().auth.signOut();
    if (error) throw error;
    router.replace("/login");
    router.refresh();
  }
  return (
    <ModuleShell
      moduleId="soil"
      moduleName="Soil"
      moduleLabel="Soil ／ データベース"
      gardenRole={user.role}
      userName={user.name}
      affiliation={user.company}
      roleLabel={GARDEN_ROLE_LABELS[user.role]}
      signOut={signOut}
      menu={<>
        <div className={rootStyles.navLabel}>メニュー</div>
        {viewAccess["soil-overview"] && (
          <Link href="/soil" className={pathname === "/soil" ? styles.active : undefined}
            aria-current={pathname === "/soil" ? "page" : undefined}>
            <RootMenuIcon icon="home" />ホーム
          </Link>
        )}
        {visibleSoilMenus(viewAccess).map(menu => {
          const href = `/soil/${menu.slug}`;
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={menu.slug} href={href} className={active ? styles.active : undefined}
              aria-current={active ? "page" : undefined}>
              <RootMenuIcon icon={menu.icon} /><span>{menu.title}</span>
            </Link>
          );
        })}
      </>}
    >{children}</ModuleShell>
  );
}
