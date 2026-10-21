"use client";

import styles from "../expenses.module.css";

import { createPortal } from "react-dom";

type Props = { open: boolean; count: number; action: string; progress?: { done: number; total: number } | null };

export function ExpenseProcessingOverlay({ open, count, action, progress }: Props) {
  if (!open) return null;
  return createPortal(
    <div className={styles.pageShell} style={backdrop} role="status" aria-live="assertive" aria-label={`${count}件を${action}中`}>
      <style>{`@keyframes bud-expense-processing-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={spinner} aria-hidden="true" />
      <strong style={title}>{count.toLocaleString("ja-JP")}件を{action}しています…</strong>
      {progress && <div style={progressText}>{progress.total.toLocaleString("ja-JP")}件中 {progress.done.toLocaleString("ja-JP")}件</div>}
      <div style={wait}>この画面を閉じないでください</div>
    </div>,
    document.body,
  );
}

const backdrop: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 10000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: 24, background: "color-mix(in srgb, var(--ink) 88%, transparent)", color: "var(--on-accent)", textAlign: "center", backdropFilter: "blur(3px)", pointerEvents: "all" };
const spinner: React.CSSProperties = { width: 72, height: 72, border: "7px solid color-mix(in srgb, var(--card) 28%, transparent)", borderTopColor: "var(--teal-d)", borderRightColor: "var(--on-accent)", borderRadius: "50%", animation: "bud-expense-processing-spin .85s linear infinite" };
const title: React.CSSProperties = { maxWidth: "min(90vw, 620px)", overflowWrap: "break-word", fontSize: 20, lineHeight: 1.6 };
const progressText: React.CSSProperties = { fontSize: 15, fontVariantNumeric: "tabular-nums" };
const wait: React.CSSProperties = { padding: "8px 14px", borderRadius: 8, background: "var(--sub)", color: "var(--teal-d)", fontWeight: 700, fontSize: 14 };
