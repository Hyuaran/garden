"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { colors } from "../_constants/colors";
import { MASTER_MENUS } from "../_constants/types";
import { UserHeader } from "./UserHeader";
import { SessionWarningModal } from "./SessionWarningModal";
import { useRootState } from "../_state/RootStateContext";

export function RootShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { canWrite } = useRootState();

  // ログイン画面はシェル無し (サイドバー・ヘッダー非表示)
  if (pathname === "/root/login") {
    return <>{children}</>;
  }

  // adminOnly メニューは admin 以上のみ表示（canWrite = admin/super_admin）。
  // manager 以下は直接 URL アクセスでも RootGate が弾くが、ナビからも非表示にする。
  const menus = MASTER_MENUS.filter((m) => !m.adminOnly || canWrite);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: colors.bg, color: colors.text, fontFamily: "system-ui, -apple-system, 'Segoe UI', Meiryo, sans-serif" }}>
      {/* サイドバー */}
      <aside style={{ width: 240, background: colors.bgSidebar, color: colors.textOnDark, padding: "24px 0", position: "sticky", top: 0, height: "100vh", overflowY: "auto", flexShrink: 0 }}>
        <div style={{ padding: "0 24px 20px", borderBottom: `1px solid ${colors.textOnDarkMuted}33` }}>
          <Link href="/root" style={{ color: colors.textOnDark, textDecoration: "none" }}>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>Garden Root</div>
            <div style={{ fontSize: 12, color: colors.textOnDarkMuted, marginTop: 4 }}>マスタ管理</div>
          </Link>
        </div>

        <nav style={{ padding: "16px 0" }}>
          {menus.map((menu) => {
            const href = `/root/${menu.slug}`;
            const active = pathname === href || pathname?.startsWith(href + "/");
            return (
              <Link
                key={menu.slug}
                href={href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 24px",
                  color: active ? colors.textOnDark : colors.textOnDarkMuted,
                  background: active ? colors.bgSidebarHover : "transparent",
                  borderLeft: active ? `3px solid ${colors.accent}` : "3px solid transparent",
                  textDecoration: "none",
                  fontSize: 14,
                }}
              >
                <span style={{ fontSize: 18 }}>{menu.icon}</span>
                <span>{menu.title}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* メインコンテンツ */}
      <main style={{ flex: 1, maxWidth: "100%", overflow: "auto", display: "flex", flexDirection: "column" }}>
        <UserHeader />
        <div style={{ padding: "24px 32px", flex: 1 }}>
          {children}
        </div>
        <SessionWarningModal />
      </main>
    </div>
  );
}
