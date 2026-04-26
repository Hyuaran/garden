"use client";

/**
 * 盆栽ビュー — 1 モジュールの配置スロット
 *
 * - enabled モジュール: <Link> でクリック可、ブランドカラー枠
 * - disabled モジュール: グレーアウト + 「準備中」tooltip、クリック不可
 *
 * 親 ModuleLayer の position: relative 内で position: absolute、
 * transform translate(-50%, -50%) で position 座標を中央基準にする。
 */

import Link from "next/link";
import type { ModuleDef } from "./_lib/modules";
import type { Position } from "./_lib/slot-positions";

type Props = {
  module: ModuleDef;
  position: Position;
};

const SLOT_SIZE = 76;

const baseSlotStyle = {
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  justifyContent: "center",
  width: SLOT_SIZE,
  height: SLOT_SIZE,
  borderRadius: "50%",
  textDecoration: "none",
  transition: "transform 0.15s ease-out",
};

export function ModuleSlot({ module: m, position }: Props) {
  const wrapperStyle = {
    position: "absolute" as const,
    left: `${50 + position.x}%`,
    top: `${50 + position.y}%`,
    transform: "translate(-50%, -50%)",
    zIndex: 2,
  };

  // tooltip / aria-label 用ラベル: 「Tree（成長）」「Bud（成果）」等（NotebookLM 4 カテゴリ）
  const accessibleLabel = `${m.label}（${m.category}）`;

  if (!m.enabled) {
    return (
      <div
        style={wrapperStyle}
        aria-disabled="true"
        aria-label={`${accessibleLabel} — 準備中`}
        title={`${accessibleLabel} — 準備中`}
      >
        <div
          style={{
            ...baseSlotStyle,
            background: "rgba(220, 220, 220, 0.55)",
            border: "2px solid #c8c8c8",
            color: "#888",
            opacity: 0.55,
            cursor: "not-allowed",
          }}
        >
          <div style={{ fontSize: 26 }} aria-hidden>{m.emoji}</div>
          <div style={{ fontSize: 10, marginTop: 2 }}>{m.label}</div>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={m.href}
      style={wrapperStyle}
      aria-label={accessibleLabel}
      title={accessibleLabel}
    >
      <div
        style={{
          ...baseSlotStyle,
          background: "rgba(255, 255, 255, 0.88)",
          border: `2px solid ${m.color}`,
          color: "#333",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ fontSize: 26 }} aria-hidden>{m.emoji}</div>
        <div style={{ fontSize: 10, fontWeight: 600, marginTop: 2 }}>{m.label}</div>
      </div>
    </Link>
  );
}
