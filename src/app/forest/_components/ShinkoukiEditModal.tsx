"use client";

/**
 * 進行期編集モーダル（タブ付き）
 *
 * - 📊 数値更新 / 🔄 期の切り替え
 * - Esc: 閉じる
 * - Ctrl+↑/↓: 前/次の法人へ（sort_order 順）
 */
import { useEffect, useState } from "react";

import { C } from "../_constants/colors";
import type { Company, Shinkouki } from "../_constants/companies";
import { NumberUpdateForm } from "./NumberUpdateForm";
import { PeriodRolloverForm } from "./PeriodRolloverForm";

type Props = {
  company: Company;
  shinkouki: Shinkouki;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onNavigate: (direction: 1 | -1) => void;
  navIndex: { current: number; total: number };
};

type Tab = "numbers" | "rollover";

export function ShinkoukiEditModal({
  company,
  shinkouki,
  onClose,
  onSaved,
  onNavigate,
  navIndex,
}: Props) {
  const [tab, setTab] = useState<Tab>("numbers");

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.ctrlKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        onNavigate(e.key === "ArrowDown" ? 1 : -1);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, onNavigate]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 24,
          width: "100%",
          maxWidth: 560,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 24px 48px rgba(0,0,0,0.2)",
        }}
      >
        {/* ヘッダー */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: company.color }} />
          <div style={{ flex: 1, fontSize: 16, fontWeight: 600, color: C.textDark }}>
            {company.short} 第{shinkouki.ki}期
          </div>
          <div style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: C.mintBg, color: C.midGreen }}>
            進行期
          </div>
          <button
            onClick={onClose}
            aria-label="閉じる"
            style={{
              border: "none",
              background: "transparent",
              fontSize: 20,
              color: C.textMuted,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* ナビ */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 16, fontSize: 12, color: C.textSub }}>
          <button
            type="button"
            onClick={() => onNavigate(-1)}
            disabled={navIndex.current === 0}
            aria-label="前の法人"
            style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: C.textSub }}
            title="前の法人 (Ctrl+↑)"
          >
            ▲
          </button>
          <span>
            {navIndex.current + 1} / {navIndex.total}
          </span>
          <button
            type="button"
            onClick={() => onNavigate(1)}
            disabled={navIndex.current === navIndex.total - 1}
            aria-label="次の法人"
            style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: C.textSub }}
            title="次の法人 (Ctrl+↓)"
          >
            ▼
          </button>
        </div>

        {/* タブ */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: `1px solid ${C.mintBg}` }}>
          <button
            type="button"
            onClick={() => setTab("numbers")}
            style={{
              padding: "10px 16px",
              border: "none",
              background: "transparent",
              borderBottom: tab === "numbers" ? `2px solid ${C.midGreen}` : "2px solid transparent",
              color: tab === "numbers" ? C.midGreen : C.textSub,
              fontSize: 14,
              fontWeight: tab === "numbers" ? 600 : 400,
              cursor: "pointer",
            }}
          >
            📊 数値更新
          </button>
          <button
            type="button"
            onClick={() => setTab("rollover")}
            style={{
              padding: "10px 16px",
              border: "none",
              background: "transparent",
              borderBottom: tab === "rollover" ? `2px solid ${C.midGreen}` : "2px solid transparent",
              color: tab === "rollover" ? C.midGreen : C.textSub,
              fontSize: 14,
              fontWeight: tab === "rollover" ? 600 : 400,
              cursor: "pointer",
            }}
          >
            🔄 期の切り替え
          </button>
        </div>

        {/* タブコンテンツ */}
        {tab === "numbers" ? (
          <NumberUpdateForm
            companyId={company.id}
            initial={shinkouki}
            onSaved={async () => {
              await onSaved();
              onClose();
            }}
            onClose={onClose}
          />
        ) : (
          <PeriodRolloverForm
            companyId={company.id}
            current={shinkouki}
            onRolledOver={async () => {
              await onSaved();
              onClose();
            }}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}
