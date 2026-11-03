"use client";
import { createPortal } from "react-dom";
import DoneOverlay from "../_components/DoneOverlay/DoneOverlay";

export type LineSendState =
  | { phase: "sending"; count: number }
  | { phase: "done"; sent: number; failed: number };

/**
 * 一斉送信の「送信中 → 送信しました」の全画面表示（ListProcessingOverlay と同じ社長スタイルの幕）。
 * 送れたら一瞬だけ出して閉じる。失敗があったときは自動で閉じず［閉じる］で閉じる。
 * body 直下に描く（祖先に transform があると position: fixed が画面基準にならないため）。
 */
export default function LineSendOverlay({
  state,
  onClose,
}: {
  state: LineSendState | null;
  onClose: () => void;
}) {
  if (!state) return null;
  const title =
    state.phase === "sending"
      ? `${state.count.toLocaleString("ja-JP")}人に送信しています…`
      : state.failed
        ? `${state.sent.toLocaleString("ja-JP")}人に送信しました。${state.failed.toLocaleString("ja-JP")}人への送信に失敗しました。`
        : `${state.sent.toLocaleString("ja-JP")}人に送信しました`;
  if (state.phase === "done")
    return (
      <DoneOverlay title={title} failed={state.failed > 0} onClose={onClose} />
    );
  return createPortal(
    <div
      role="status"
      aria-live="assertive"
      aria-label={title}
      style={backdrop}
    >
      <style>{`@keyframes line-send-spin { to { transform: rotate(360deg); } } @keyframes line-send-pop { from { transform: scale(.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
      <div aria-hidden="true" style={spinner} />
      <strong
        style={{
          fontSize: 20,
          lineHeight: 1.6,
          maxWidth: "min(90vw, 620px)",
          overflowWrap: "anywhere",
        }}
      >
        {title}
      </strong>
      {state.phase === "sending" && (
        <p style={wait}>この画面を閉じないでください</p>
      )}
    </div>,
    document.body,
  );
}

const backdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 10000,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 18,
  padding: 24,
  background: "rgba(16, 35, 63, 0.9)",
  color: "#ffffff",
  textAlign: "center",
  backdropFilter: "blur(3px)",
  pointerEvents: "all",
  fontFamily: 'Meiryo, "Noto Sans JP", sans-serif',
};
const spinner: React.CSSProperties = {
  width: 72,
  height: 72,
  border: "7px solid rgba(255,255,255,0.22)",
  borderTopColor: "#0ea5a0",
  borderRightColor: "#ffffff",
  borderRadius: "50%",
  animation: "line-send-spin .85s linear infinite",
};
const wait: React.CSSProperties = {
  margin: 0,
  padding: "8px 14px",
  borderRadius: 999,
  background: "#fff7e6",
  color: "#8a5a00",
  fontWeight: 700,
  fontSize: 14,
};
