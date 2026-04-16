"use client";

/**
 * Garden-Tree シェル（サイドバー + KPI ヘッダー + 本文）
 *
 * layout.tsx から切り出したクライアント専用コンポーネント。
 * /tree/login のみサイドバー・ヘッダーを出さず全画面表示にする。
 */

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { TREE_PATHS } from "../_constants/screens";
import { KPIHeader } from "./KPIHeader";
import { SidebarNav } from "./SidebarNav";

const SIDEBAR_COLLAPSED_WIDTH = 56;

export function TreeShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";
  const isBareScreen = pathname === TREE_PATHS.LOGIN;

  if (isBareScreen) {
    return <>{children}</>;
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <SidebarNav />
      <div
        style={{
          marginLeft: SIDEBAR_COLLAPSED_WIDTH,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <KPIHeader />
        <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
