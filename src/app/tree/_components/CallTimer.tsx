"use client";

/**
 * Garden-Tree 架電タイマー
 *
 * プロトタイプの CallTimer を TypeScript 化。
 * 2つの表示モード:
 *  - barStyle = true  → ステータスバー風（Branch 架電画面で使用）
 *  - barStyle = false → コンパクト（インライン表示用）
 *
 * phase が変わるとタイマーリセット。threshold 超過で赤くなる。
 */

import { useEffect, useState } from "react";

import { C } from "../_constants/colors";

type CallTimerProps = {
  /** "waiting" | "calling" | "talking" | "inputting" */
  phase: string;
  /** 閾値(秒)。超過するとタイマーが赤くなる */
  threshold?: number;
  /** ステータスバー風の表示にするか（既定 false = コンパクト） */
  barStyle?: boolean;
};

export function CallTimer({
  phase,
  threshold = 20,
  barStyle = false,
}: CallTimerProps) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    setSeconds(0);
    const iv = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [phase]);

  const isOver = seconds >= threshold;
  const isWaiting = phase === "waiting";
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  if (barStyle) {
    const label = isWaiting ? "選定中" : "架電中";
    const dotColor = isOver ? C.red : isWaiting ? C.gold : C.midGreen;
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 16px",
          borderRadius: 12,
          background: isWaiting
            ? isOver
              ? "rgba(196,74,74,0.08)"
              : "rgba(201,168,76,0.08)"
            : isOver
              ? "rgba(196,74,74,0.08)"
              : "rgba(45,106,79,0.06)",
          border: `1px solid ${
            isOver
              ? "rgba(196,74,74,0.15)"
              : isWaiting
                ? "rgba(201,168,76,0.15)"
                : "rgba(45,106,79,0.1)"
          }`,
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: dotColor,
            animation: "pulse 1.5s infinite",
          }}
        />
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: isOver
              ? C.red
              : isWaiting
                ? C.gold
                : "#2d6a8a",
          }}
        >
          {label}
        </span>
        <span style={{ fontSize: 14, color: C.textMuted }}>—</span>
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: isOver
              ? C.red
              : isWaiting
                ? C.gold
                : "#2d6a8a",
          }}
        >
          {mm}:{ss}
        </span>
      </div>
    );
  }

  // コンパクトスタイル
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 16px",
        borderRadius: 10,
        background: isWaiting
          ? isOver
            ? "rgba(196,74,74,0.08)"
            : "rgba(201,168,76,0.1)"
          : isOver
            ? "rgba(196,74,74,0.08)"
            : "rgba(45,106,79,0.06)",
        border: `1px solid ${
          isWaiting
            ? isOver
              ? "rgba(196,74,74,0.2)"
              : "rgba(201,168,76,0.2)"
            : isOver
              ? "rgba(196,74,74,0.2)"
              : "rgba(45,106,79,0.1)"
        }`,
        transition: "all 0.3s ease",
      }}
    >
      {isWaiting && (
        <span
          style={{
            fontSize: 11,
            color: isOver ? C.red : C.gold,
            fontWeight: 600,
          }}
        >
          選定中
        </span>
      )}
      {!isWaiting && (
        <span
          style={{
            fontSize: 11,
            color: isOver ? C.red : C.midGreen,
            fontWeight: 600,
          }}
        >
          架電中
        </span>
      )}
      <span
        style={{
          fontSize: 20,
          fontWeight: 800,
          fontFamily: "monospace",
          letterSpacing: 2,
          color: isOver ? C.red : isWaiting ? C.gold : C.textDark,
        }}
      >
        {mm}:{ss}
      </span>
    </div>
  );
}
