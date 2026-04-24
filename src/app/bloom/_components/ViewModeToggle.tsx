"use client";

import { useViewMode } from "../_state/ViewModeContext";

/**
 * 表示モードトグル（👥みんな向け / ⚙️開発向け）
 *
 * BloomShell 右上に固定配置。クリックで Context 経由で全画面再描画。
 */
export function ViewModeToggle() {
  const { mode, toggle } = useViewMode();
  const simple = mode === "simple";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={!simple}
      title={simple ? "開発向け表示に切替" : "みんな向け表示に切替"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 8px",
        fontSize: 11,
        fontWeight: 600,
        borderRadius: 999,
        border: "1px solid #d8f3dc",
        background: simple ? "#d8f3dc" : "#1b4332",
        color: simple ? "#1b4332" : "#d8f3dc",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "background 0.15s ease, color 0.15s ease",
      }}
    >
      <span>{simple ? "👥" : "⚙️"}</span>
      <span>{simple ? "みんな向け" : "開発向け"}</span>
    </button>
  );
}
