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
import type { ModuleDef, ModuleKey } from "./_lib/modules";
import type { Position } from "./_lib/slot-positions";

type Props = {
  moduleKey: ModuleKey;
  module: ModuleDef;
  position: Position;
};

const SLOT_SIZE = 92;  // 候補 8: 2 行 label に対応するため拡大（76→92）

const baseSlotStyle = {
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  justifyContent: "center",
  width: SLOT_SIZE,
  height: SLOT_SIZE,
  borderRadius: "50%",
  textDecoration: "none",
  // transition は .gv-slot class（globals.css）で定義、ここで inline 指定すると
  // filter / box-shadow が snap 表示になる（inline > class specificity）。
};

export function ModuleSlot({ moduleKey, module: m, position }: Props) {
  const wrapperStyle = {
    position: "absolute" as const,
    left: `${50 + position.x}%`,
    top: `${50 + position.y}%`,
    transform: "translate(-50%, -50%)",
    zIndex: 2,
  };

  // tooltip / aria-label 用ラベル: 「Tree（地上）」「Bloom（樹冠）」等（3 レイヤー）
  const accessibleLabel = `${m.label}（${m.layer}）`;

  if (!m.enabled) {
    return (
      <div
        style={wrapperStyle}
        aria-disabled="true"
        aria-label={`${accessibleLabel} — 準備中`}
        title={`${accessibleLabel} — 準備中`}
      >
        <div
          className="gv-slot"
          data-module-key={moduleKey}
          style={{
            ...baseSlotStyle,
            background: "rgba(220, 220, 220, 0.55)",
            border: "2px solid #c8c8c8",
            color: "#888",
            opacity: 0.55,
            cursor: "not-allowed",
          }}
        >
          <img
            src={`/themes/module-icons/${moduleKey}.webp`}
            alt=""
            aria-hidden
            width={40}
            height={40}
            style={{ display: "block", objectFit: "contain", filter: "grayscale(0.6)" }}
          />
          <div style={{ fontSize: 10, fontWeight: 600, marginTop: 2, lineHeight: 1.1 }}>{m.label}</div>
          <div style={{ fontSize: 8, color: "#888", marginTop: 1, lineHeight: 1.1, textAlign: "center" }}>{m.description}</div>
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
        className="gv-slot"
        data-module-key={moduleKey}
        style={{
          ...baseSlotStyle,
          background: "rgba(255, 255, 255, 0.88)",
          border: `2px solid ${m.color}`,
          color: "#333",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}
      >
        <img
          src={`/themes/module-icons/${moduleKey}.webp`}
          alt=""
          aria-hidden
          width={40}
          height={40}
          style={{ display: "block", objectFit: "contain" }}
        />
        <div style={{ fontSize: 10, fontWeight: 600, marginTop: 2, lineHeight: 1.1 }}>{m.label}</div>
        <div style={{ fontSize: 8, color: "#5C6E5F", marginTop: 1, lineHeight: 1.1, textAlign: "center" }}>{m.description}</div>
      </div>
    </Link>
  );
}
