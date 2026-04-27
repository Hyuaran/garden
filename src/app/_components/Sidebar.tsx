"use client";

/**
 * Garden Series 左サイドバー（v6 dispatch Step 2、業務ドメイン軸）
 *
 * memory project_garden_dual_axis_navigation §1（業務ドメイン軸 sidebar）+ §2（権限連動）準拠。
 * 8 role 対応: known-pitfalls #6 で確定の garden_role 8 値（toss/closer/cs/staff/outsource/manager/admin/super_admin）
 *
 * outsource は最小項目（ホームのみ）、staff 以上で全 7 項目、cs は顧客 + ホーム。
 * 5/5 デモは role プロパティ未渡 → super_admin デフォルトで全項目可視。
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HelpCard } from "./HelpCard";

type GardenRole =
  | "toss" | "closer" | "cs" | "staff" | "outsource" | "manager" | "admin" | "super_admin";

type NavItem = {
  href: string;
  icon: string;
  label: string;
  /** この role 以上でのみ表示 */
  minRole: GardenRole;
};

const ROLE_RANK: Record<GardenRole, number> = {
  outsource: 0,
  toss: 1,
  closer: 2,
  cs: 3,
  staff: 4,
  manager: 5,
  admin: 6,
  super_admin: 7,
};

const NAV_ITEMS: NavItem[] = [
  { href: "/",                 icon: "🍃", label: "ホーム",         minRole: "toss" },
  { href: "/bloom/workboard",  icon: "📊", label: "ダッシュボード", minRole: "staff" },
  { href: "/bud",              icon: "💼", label: "取引",           minRole: "staff" },
  { href: "/leaf",             icon: "👤", label: "顧客",           minRole: "cs" },
  { href: "/root",             icon: "🔄", label: "ワークフロー",   minRole: "staff" },
  { href: "/forest",           icon: "📈", label: "レポート",       minRole: "manager" },
  { href: "/root/settings",    icon: "⚙️", label: "設定",           minRole: "admin" },
];

type Props = {
  /** 現在ユーザーの権限。5/5 デモは super_admin デフォルト */
  role?: GardenRole;
};

export function Sidebar({ role = "super_admin" }: Props) {
  const pathname = usePathname();
  const userRank = ROLE_RANK[role];
  const visibleItems = NAV_ITEMS.filter((item) => userRank >= ROLE_RANK[item.minRole]);

  return (
    <aside
      data-testid="app-sidebar"
      style={{
        width: 220,
        minWidth: 220,
        height: "100vh",
        position: "sticky",
        top: 0,
        display: "flex",
        flexDirection: "column",
        background: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(12px)",
        borderRight: "1px solid #E8E5DD",
        boxShadow: "2px 0 8px rgba(0,0,0,0.04)",
        zIndex: 10,
      }}
    >
      {/* logo small */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "20px 16px 12px", borderBottom: "1px solid #E8E5DD" }}>
        <img
          src="/themes/garden-logo.webp"
          alt="Garden Series"
          width={32}
          height={32}
          style={{ display: "block", objectFit: "contain" }}
        />
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#1F5C3A", lineHeight: 1.1 }}>
            Garden
          </div>
          <div style={{ fontSize: 9, color: "#6B8E75", marginTop: 1 }}>
            Series
          </div>
        </div>
      </div>

      {/* nav */}
      <nav
        aria-label="業務ドメインナビゲーション"
        style={{ flex: 1, padding: "12px 8px", overflowY: "auto" }}
      >
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={`sidebar-nav-${item.href.replace(/\//g, "-")}`}
              aria-current={isActive ? "page" : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                marginBottom: 4,
                borderRadius: 8,
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? "#1F5C3A" : "#5C6E5F",
                background: isActive ? "rgba(168, 216, 122, 0.18)" : "transparent",
                borderLeft: isActive ? "3px solid #3B9B5C" : "3px solid transparent",
                textDecoration: "none",
                transition: "background 0.15s ease, transform 0.15s ease",
              }}
            >
              <span aria-hidden style={{ fontSize: 16 }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* HelpCard at bottom */}
      <div style={{ padding: "12px 12px 16px", borderTop: "1px solid #E8E5DD" }}>
        <HelpCard />
      </div>
    </aside>
  );
}
