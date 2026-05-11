"use client";

/**
 * Garden 共通 認証ローディング画面 (2026-05-11、Task 3)
 *
 * ModuleGate.tsx が認証確認中・redirect 待機中に表示する共通スピナー UI。
 * モジュール別の絵文字 + メッセージで視覚的にどのモジュールへのアクセスか分かるようにする。
 *
 * 仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md §Task 3 §Step 3-3
 */

import type { GardenModule } from "../_constants/module-min-roles";

const MODULE_EMOJI: Record<GardenModule, string> = {
  soil: "🟫",
  root: "🌱",
  tree: "🌳",
  leaf: "🍃",
  bud: "🌷",
  bloom: "🌸",
  seed: "🌾",
  forest: "🌲",
  rill: "💧",
  fruit: "🍎",
  sprout: "🌱",
  calendar: "📅",
};

export function AuthLoadingScreen({
  module,
  message,
}: {
  module: GardenModule;
  message: string;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg,#f8fafc 0%,#f1f5f9 100%)",
        fontFamily: "'Noto Sans JP', sans-serif",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: "32px 28px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 8 }}>{MODULE_EMOJI[module]}</div>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>{message}</p>
      </div>
    </div>
  );
}
