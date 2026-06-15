"use client";

/**
 * Garden 共通「ショートカット一覧」モーダル。
 *
 * - 画面中央にオーバーレイ表示
 * - Esc / 背景クリック / × で閉じる
 * - 表示内容は garden-shortcuts.ts（正本）を読むだけ
 * - スタイルは自己完結（inline）。どの系統のヘッダーからでも流用できるようにする。
 */

import { useEffect } from "react";

import { GARDEN_SHORTCUTS } from "./garden-shortcuts";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ShortcutsModal({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="キーボードショートカット一覧"
      data-testid="shortcuts-modal"
      onClick={onClose}
      style={overlay}
    >
      <div onClick={(e) => e.stopPropagation()} style={card}>
        <div style={header}>
          <span style={titleStyle}>⌨ キーボードショートカット</span>
          <button type="button" aria-label="閉じる" onClick={onClose} style={closeBtn}>
            ×
          </button>
        </div>

        <div style={body}>
          {GARDEN_SHORTCUTS.map((group) => (
            <section key={group.title} style={section}>
              <h3 style={groupTitle}>{group.title}</h3>
              <ul style={list}>
                {group.items.map((item) => (
                  <li key={`${group.title}-${item.label}`} style={row}>
                    <span style={keysWrap}>
                      {item.keys.map((k, i) => (
                        <span key={`${item.label}-${k}-${i}`} style={keysWrap}>
                          {i > 0 && <span style={plus}>+</span>}
                          <kbd style={kbd}>{k}</kbd>
                        </span>
                      ))}
                    </span>
                    <span style={labelWrap}>
                      {item.label}
                      {item.note && <span style={note}>{item.note}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div style={footer}>Esc で閉じる</div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(20, 28, 22, 0.45)",
  backdropFilter: "blur(2px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: 20,
};

const card: React.CSSProperties = {
  width: "min(560px, 100%)",
  maxHeight: "85vh",
  display: "flex",
  flexDirection: "column",
  background: "#fff",
  borderRadius: 14,
  border: "1px solid #DEE5DE",
  boxShadow: "0 20px 60px rgba(0,0,0,0.28)",
  overflow: "hidden",
};

const header: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px 20px",
  borderBottom: "1px solid #E8EAE3",
  background: "linear-gradient(135deg, #F4F8F1, #ffffff)",
};

const titleStyle: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: "#2B3B2E" };

const closeBtn: React.CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontSize: 22,
  lineHeight: 1,
  color: "#7A8B7E",
  padding: 4,
};

const body: React.CSSProperties = { padding: "8px 20px 16px", overflowY: "auto" };

const section: React.CSSProperties = { marginTop: 14 };

const groupTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#5C6E5F",
  margin: "0 0 8px",
  letterSpacing: 0.3,
};

const list: React.CSSProperties = { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 };

const row: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12 };

const keysWrap: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 };

const plus: React.CSSProperties = { color: "#9AA89C", fontSize: 11 };

const kbd: React.CSSProperties = {
  display: "inline-block",
  minWidth: 22,
  textAlign: "center",
  padding: "3px 7px",
  fontSize: 11,
  fontWeight: 600,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  color: "#2B3B2E",
  background: "#F0F4F0",
  border: "1px solid #D3DDD3",
  borderBottomWidth: 2,
  borderRadius: 6,
};

const labelWrap: React.CSSProperties = { fontSize: 13, color: "#2B2B2B", display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" };

const note: React.CSSProperties = { fontSize: 11, color: "#8A968C" };

const footer: React.CSSProperties = {
  padding: "10px 20px",
  borderTop: "1px solid #E8EAE3",
  fontSize: 11,
  color: "#9AA89C",
  textAlign: "right",
};
