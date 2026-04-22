"use client";

import Link from "next/link";
import { MASTER_MENUS } from "./_constants/types";
import { colors } from "./_constants/colors";
import { PageHeader } from "./_components/PageHeader";

export default function RootTopPage() {
  return (
    <>
      <PageHeader
        title="マスタ管理"
        description="Garden シリーズ全モジュールで参照される基礎マスタ。削除は不可、無効化で管理します。"
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
        {MASTER_MENUS.map((menu) => (
          <Link
            key={menu.slug}
            href={`/root/${menu.slug}`}
            style={{
              background: colors.bgPanel,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              padding: 20,
              textDecoration: "none",
              color: colors.text,
              transition: "transform 0.15s, box-shadow 0.15s",
              display: "block",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>{menu.icon}</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{menu.title}</div>
            <div style={{ fontSize: 12, color: colors.textMuted, lineHeight: 1.5 }}>{menu.description}</div>
          </Link>
        ))}
      </div>
    </>
  );
}
