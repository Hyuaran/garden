"use client";

import { useCallback, useEffect, useState } from "react";

import type { MonthlyDigest } from "../../_types/monthly-digest";
import { DigestPageRenderer } from "./DigestPageRenderer";

type Props = {
  digest: MonthlyDigest;
  startIndex?: number;
  onClose: () => void;
};

export function ProjectionViewer({ digest, startIndex = 0, onClose }: Props) {
  const total = digest.pages.length;
  const [index, setIndex] = useState(Math.min(startIndex, Math.max(0, total - 1)));

  const next = useCallback(() => {
    setIndex((i) => Math.min(i + 1, total - 1));
  }, [total]);

  const prev = useCallback(() => {
    setIndex((i) => Math.max(i - 1, 0));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onClose]);

  if (total === 0) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        style={backdropStyle}
      >
        <div style={{ color: "#fff", fontSize: 24 }}>
          ページがありません
          <button onClick={onClose} style={closeBtnStyle}>
            × 閉じる
          </button>
        </div>
      </div>
    );
  }

  const page = digest.pages[index];

  return (
    <div role="dialog" aria-modal="true" style={backdropStyle}>
      <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 8 }}>
        <span style={{ color: "#d8f3dc", fontSize: 14, alignSelf: "center" }}>
          {index + 1} / {total}
        </span>
        <button onClick={onClose} style={closeBtnStyle} type="button">
          × 閉じる (Esc)
        </button>
      </div>

      <div style={{ width: "100%", maxWidth: 1280, padding: "0 48px" }}>
        <DigestPageRenderer page={page} digest={digest} projection />
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 24,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 12,
        }}
      >
        <button
          onClick={prev}
          disabled={index === 0}
          type="button"
          style={navBtnStyle(index === 0)}
        >
          ← 前へ
        </button>
        <button
          onClick={next}
          disabled={index >= total - 1}
          type="button"
          style={navBtnStyle(index >= total - 1)}
        >
          次へ →
        </button>
      </div>
    </div>
  );
}

const backdropStyle = {
  position: "fixed",
  inset: 0,
  background: "#0b3a2d",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: 24,
} as const;

const closeBtnStyle = {
  padding: "6px 14px",
  background: "rgba(255,255,255,0.12)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.3)",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
} as const;

function navBtnStyle(disabled: boolean) {
  return {
    padding: "10px 24px",
    background: disabled ? "rgba(255,255,255,0.05)" : "#40916c",
    color: disabled ? "rgba(255,255,255,0.3)" : "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    cursor: disabled ? "default" : "pointer",
    fontFamily: "inherit",
  } as const;
}
