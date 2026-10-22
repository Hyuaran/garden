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

// 社長スタイル版の固定色（Loading スタイル・リストマスタの ListProcessingOverlay と同じ）。
// 以前は明暗の変数（--ink・--on-accent・--sub・--teal-d）を使っていて、暗い表示で文字が地に溶けて読めなかった（東海林さん 2026-10-22）
const backdrop: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 10000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: 24, background: "rgba(16,35,63,.9)", color: "#ffffff", textAlign: "center", backdropFilter: "blur(3px)", pointerEvents: "all", fontFamily: "Meiryo, \"Hiragino Kaku Gothic ProN\", \"Noto Sans JP\", sans-serif" };
const spinner: React.CSSProperties = { width: 72, height: 72, border: "7px solid rgba(255,255,255,0.28)", borderTopColor: "#0ea5a0", borderRightColor: "#ffffff", borderRadius: "50%", animation: "bud-expense-processing-spin .85s linear infinite" };
const title: React.CSSProperties = { maxWidth: "min(90vw, 620px)", overflowWrap: "break-word", fontSize: 20, lineHeight: 1.6, color: "#ffffff" };
const progressText: React.CSSProperties = { fontSize: 15, fontVariantNumeric: "tabular-nums", color: "#ffffff" };
const wait: React.CSSProperties = { padding: "8px 14px", borderRadius: 8, background: "#fff7e6", color: "#8a5a00", fontWeight: 700, fontSize: 14 };
