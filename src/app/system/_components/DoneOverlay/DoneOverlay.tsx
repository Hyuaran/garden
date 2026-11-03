"use client";
import { createPortal } from "react-dom";

export default function DoneOverlay({
  title,
  failed = false,
  onClose,
}: {
  title: string;
  failed?: boolean;
  onClose?: () => void;
}) {
  return createPortal(
    <div
      role="status"
      aria-live="assertive"
      aria-label={title}
      style={backdrop}
    >
      <style>{`@keyframes line-send-pop { from { transform: scale(.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
      <svg
        aria-hidden="true"
        viewBox="0 0 72 72"
        width="72"
        height="72"
        style={{ animation: "line-send-pop .25s ease-out" }}
      >
        <circle
          cx="36"
          cy="36"
          r="32"
          fill="none"
          stroke={failed ? "#f6b26b" : "#0ea5a0"}
          strokeWidth="6"
        />
        {failed ? (
          <path
            d="M36 20v20M36 50v2"
            fill="none"
            stroke="#f6b26b"
            strokeWidth="6"
            strokeLinecap="round"
          />
        ) : (
          <path
            d="M22 37l10 10 19-21"
            fill="none"
            stroke="#ffffff"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
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
      {failed && onClose && (
        <button type="button" onClick={onClose} style={closeButton}>
          閉じる
        </button>
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
const closeButton: React.CSSProperties = {
  padding: "10px 28px",
  borderRadius: 10,
  border: "1px solid #ffffff",
  background: "transparent",
  color: "#ffffff",
  fontWeight: 700,
  fontSize: 15,
  cursor: "pointer",
};
