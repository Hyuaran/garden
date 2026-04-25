"use client";

/**
 * Garden-Bloom 全体のシェル（ヘッダー + ナビ + 本文領域）
 *
 * Forest ForestShell を踏襲。Bloom は「花」モチーフで
 * グリーン系グラデーション + 🌸 アイコン。
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { BLOOM_PATHS } from "../_constants/routes";
import { useBloomState } from "../_state/BloomStateContext";
import { ViewModeToggle } from "./ViewModeToggle";

const NAV_ITEMS: Array<{ href: string; label: string }> = [
  { href: BLOOM_PATHS.WORKBOARD, label: "Workboard" },
  { href: BLOOM_PATHS.ROADMAP, label: "ロードマップ" },
  { href: BLOOM_PATHS.MONTHLY_DIGEST, label: "月次ダイジェスト" },
  { href: BLOOM_PATHS.DAILY_REPORTS, label: "日報" },
];

export function BloomShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";
  const { bloomUser, userEmail, lockAndLogout } = useBloomState();

  // ログインページではシェル（ヘッダ + ナビ）を表示しない（Forest と同パターン）
  const isLoginPage = pathname === BLOOM_PATHS.LOGIN;
  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f0fdf4 0%, #ffffff 160px)",
        fontFamily: "'Noto Sans JP', 'Yu Gothic', 'Meiryo', sans-serif",
        color: "#1b4332",
      }}
    >
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: "linear-gradient(90deg, #40916c 0%, #95d5b2 100%)",
          zIndex: 100,
        }}
      />

      <header
        style={{
          padding: "20px 32px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 4,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1b4332", margin: 0 }}>
            🌸 Garden Bloom
          </h1>
          <p style={{ fontSize: 12, color: "#6b8e75", margin: 0 }}>
            作業可視化・ロードマップ・月次ダイジェスト
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ViewModeToggle />
          <span style={{ fontSize: 12, color: "#40916c" }}>
            {bloomUser?.name ?? userEmail ?? ""}
          </span>
          <button
            onClick={() => lockAndLogout("manual")}
            style={{
              padding: "6px 16px",
              border: "1px solid #95d5b2",
              borderRadius: 8,
              background: "transparent",
              color: "#40916c",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ログアウト
          </button>
        </div>
      </header>

      <nav
        style={{
          display: "flex",
          gap: 4,
          padding: "12px 32px 0",
          borderBottom: "1px solid #d8f3dc",
        }}
      >
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                color: active ? "#1b4332" : "#6b8e75",
                textDecoration: "none",
                borderBottom: active ? "2px solid #40916c" : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <main style={{ padding: "24px 32px 40px" }}>{children}</main>
    </div>
  );
}
