"use client";

/**
 * Forest 認証ゲート — redirect-only shell (2026-05-11、Task 1)
 *
 * 旧 ForestGate (社員番号 + パスワードフォーム) は
 * ForestGate.legacy-20260511.tsx に保管。
 *
 * 本ファイルは Garden Series 統一ログイン画面 /login への redirect のみを行う
 * 薄いシェル。Task 3 で ModuleGate ラッパー化される予定。
 *
 * 仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md §Task 1 §Step 4
 */

import { useEffect } from "react";

import { FOREST_THEME } from "../_constants/theme";

export function ForestGate() {
  useEffect(() => {
    const current =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/forest/dashboard";
    window.location.replace(`/login?returnTo=${encodeURIComponent(current)}`);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: FOREST_THEME.loginBackground,
        fontFamily: "'Noto Sans JP', sans-serif",
      }}
    >
      <p style={{ color: "#fff" }}>ログインページに移動しています…</p>
    </div>
  );
}
