"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ModuleShell } from "@/app/_components/layout/GardenShell/ModuleShell";
import { createBrowserClient } from "@/app/_lib/supabase/browser";
import { GARDEN_ROLE_LABELS, type GardenRole } from "@/app/root/_constants/types";
import { RootMenuIcon } from "@/app/root/_components/RootMenuIcon";
import { UnavailableHeaderViewToggle } from "@/app/system/_components/HeaderViewToggle";
import styles from "@/app/system/_components/ShachoShell/shacho-shell.module.css";
import rootStyles from "@/app/root/_components/root-shell.module.css";
import { visibleLeafMenus } from "../_constants/menus";

export function LeafShell({ children, viewAccess, user }: {
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
      moduleId="leaf"
      moduleName="Leaf"
      moduleLabel="Leaf"
      gardenRole={user.role}
      userName={user.name}
      affiliation={user.company}
      roleLabel={GARDEN_ROLE_LABELS[user.role]}
      signOut={signOut}
      menu={<>
        <div className={rootStyles.navLabel}>メニュー</div>
        {viewAccess["leaf-overview"] && (
          <Link href="/leaf" className={pathname === "/leaf" ? styles.active : undefined}
            aria-current={pathname === "/leaf" ? "page" : undefined}>
            <RootMenuIcon icon="home" />概要
          </Link>
        )}
        {visibleLeafMenus(viewAccess).map(menu => {
          const href = `/leaf/${menu.slug}`;
          const active = pathname === href || (pathname.startsWith(href + "/") && pathname !== "/leaf/kanden/entry");
          return (
            <Link key={menu.slug} href={href} prefetch={false} className={active ? styles.active : undefined}
              aria-current={active ? "page" : undefined}>
              <RootMenuIcon icon={menu.icon} /><span>{menu.title}</span>
            </Link>
          );
        })}
      </>}
    >
      <UnavailableHeaderViewToggle />
      {children}
    </ModuleShell>
  );
}
