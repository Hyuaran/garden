"use client";

import { createPortal } from "react-dom";

type Props =
  | { open: boolean; mode: "search" }
  | { open: boolean; mode: "export"; count: number; format: string };

/**
 * 全画面の処理中表示（経費精算の ExpenseProcessingOverlay と同じ作り・色だけ社長スタイル）。
 * 地＝濃紺 #10233F を透かした幕、くるくる＝ティール #0EA5A0＋白、注意＝薄い琥珀の帯（東海林さん 2026-09-13）。
 * body 直下に描く（祖先に transform があると position: fixed が画面基準にならないため）。
 */
export function ListProcessingOverlay(props: Props) {
  if (!props.open) return null;
  const title = props.mode === "search"
    ? "条件に合う番号を検索しています…"
    : `${props.count.toLocaleString("ja-JP")}件を${props.format}で書き出しています…`;
  return createPortal(
    <div style={backdrop} role="status" aria-live="assertive" aria-label={title}>
      <style>{`@keyframes soil-list-processing-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={spinner} aria-hidden="true" />
      <strong style={titleStyle}>{title}</strong>
      <div style={wait}>この画面を閉じないでください</div>
    </div>,
    document.body,
  );
}

const backdrop: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 10000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: 24, background: "rgba(16, 35, 63, 0.9)", color: "#ffffff", textAlign: "center", backdropFilter: "blur(3px)", pointerEvents: "all", fontFamily: 'Meiryo, "Noto Sans JP", sans-serif' };
const spinner: React.CSSProperties = { width: 72, height: 72, border: "7px solid rgba(255,255,255,0.22)", borderTopColor: "#0ea5a0", borderRightColor: "#ffffff", borderRadius: "50%", animation: "soil-list-processing-spin .85s linear infinite" };
const titleStyle: React.CSSProperties = { maxWidth: "min(90vw, 620px)", overflowWrap: "anywhere", fontSize: 20, lineHeight: 1.6 };
const wait: React.CSSProperties = { padding: "8px 14px", borderRadius: 999, background: "#fff7e6", color: "#8a5a00", fontWeight: 700, fontSize: 14 };
