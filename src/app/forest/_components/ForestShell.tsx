"use client";

/**
 * Garden-Forest 全体のシェル（背景 + ヘッダー + 本文領域）
 *
 * Tree の TreeShell と同パターン。
 * ログイン画面では ForestShell を表示せず、
 * ダッシュボードのみヘッダー + ログアウトボタンを表示する。
 */

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { FOREST_THEME } from "../_constants/theme";
import { C } from "../_constants/colors";
import { fmtDateJP } from "../_lib/format";
import { useForestState } from "../_state/ForestStateContext";

export function ForestShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";
  const isLoginPage = pathname === "/forest/login" || pathname === "/forest";
  const { isUnlocked, userEmail, lockAndLogout, lastUpdated } =
    useForestState();

  // ログイン画面では背景のみ（ヘッダーなし）
  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: FOREST_THEME.background,
        fontFamily: "'Noto Sans JP', 'Yu Gothic', 'Meiryo', sans-serif",
        color: FOREST_THEME.textPrimary,
        position: "relative",
      }}
    >
      {/* 上部デコレーションバー */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: FOREST_THEME.headerBar,
          zIndex: 100,
        }}
      />

      {/* ヘッダー */}
      {isUnlocked && (
        <header
          style={{
            padding: "20px 32px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 4,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: C.darkGreen,
                margin: 0,
              }}
            >
              Garden Forest
            </h1>
            <p
              style={{
                fontSize: 12,
                color: FOREST_THEME.textMuted,
                margin: 0,
              }}
            >
              ヒュアラングループ 経営ダッシュボード
            </p>
            <p
              style={{
                fontSize: 11,
                color: FOREST_THEME.textMuted,
                opacity: 0.6,
                margin: "4px 0 0 0",
              }}
            >
              {`最終更新: ${fmtDateJP(lastUpdated?.at ?? null)}`}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 12, color: FOREST_THEME.textSecondary }}>
              {userEmail}
            </span>
            <button
              onClick={() => lockAndLogout("manual")}
              style={{
                padding: "6px 16px",
                border: `1px solid ${C.lightGreen}`,
                borderRadius: 8,
                background: "transparent",
                color: C.lightGreen,
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
      )}

      {/* 本文 */}
      <main style={{ padding: isUnlocked ? "0 32px 40px" : 0 }}>
        {children}
      </main>
    </div>
  );
}
