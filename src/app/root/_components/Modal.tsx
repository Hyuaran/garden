"use client";

import { ReactNode, useEffect } from "react";
import { colors } from "../_constants/colors";

export function Modal({
  open,
  onClose,
  onSubmit,
  title,
  children,
  width = 640,
}: {
  open: boolean;
  onClose: () => void;
  /** Enter で発火（textarea 内・IME 変換中は無視）。未指定時は無効。 */
  onSubmit?: () => void;
  title: string;
  children: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Enter" && onSubmit) {
        const target = e.target as HTMLElement | null;
        if (target && target.tagName === "TEXTAREA") return;
        if (e.isComposing) return;
        // ボタンや select のデフォルト動作はそのまま通す
        if (target && (target.tagName === "BUTTON" || target.tagName === "SELECT")) return;
        e.preventDefault();
        onSubmit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, onSubmit]);

  if (!open) return null;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        style={{ background: colors.bgPanel, width, maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8, boxShadow: "0 20px 60px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${colors.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: colors.text }}>{title}</h2>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 22, cursor: "pointer", color: colors.textMuted, lineHeight: 1 }} aria-label="閉じる">×</button>
        </div>
        <div style={{ padding: 24, overflowY: "auto" }}>{children}</div>
      </div>
    </div>
  );
}
