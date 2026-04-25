"use client";

/**
 * Garden-Forest 共通 InfoTooltip（T-F7-01）
 *
 * i アイコンをホバー or フォーカスすると吹き出しで説明を表示。
 * Esc で閉じる / Tab でフォーカス順序に乗る a11y 対応。
 *
 * v9 HTML L434-478 の `.info-wrap` / `.info-icon` / `.info-tooltip` を参考に、
 * Forest のインラインスタイル規約 (`_constants/theme.ts` のコメント参照) に
 * 合わせて書き換えた。Tailwind クラスは用いない。
 *
 * 主な利用箇所（予定）:
 *   - T-F6-03 Download Section の使い方説明
 *
 * spec: docs/specs/2026-04-24-forest-t-f7-01-info-tooltip.md
 */

import {
  useEffect,
  useId,
  useState,
  type ReactNode,
} from "react";

import { C } from "../_constants/colors";

type Placement = "top" | "bottom" | "left" | "right";
type Trigger = "hover" | "focus" | "both";

type Props = {
  /** i アイコンの aria-label。既定: '詳細情報' */
  label?: string;
  /** tooltip 先頭に表示するタイトル（太字） */
  title?: string;
  /** tooltip 本文。複数段落は ReactNode で自由に構成 */
  children: ReactNode;
  /** 配置。既定: 'top' */
  placement?: Placement;
  /** tooltip の最大幅（px）。既定: 520（v9 準拠） */
  maxWidth?: number;
  /** 開くトリガー。既定: 'both' */
  trigger?: Trigger;
};

/** placement ごとの絶対配置スタイル。 */
function placementStyle(placement: Placement): React.CSSProperties {
  switch (placement) {
    case "bottom":
      return { top: "calc(100% + 6px)", left: 0 };
    case "left":
      return { right: "calc(100% + 6px)", top: 0 };
    case "right":
      return { left: "calc(100% + 6px)", top: 0 };
    case "top":
    default:
      return { bottom: "calc(100% + 6px)", left: 0 };
  }
}

export function InfoTooltip({
  label = "詳細情報",
  title,
  children,
  placement = "top",
  maxWidth = 520,
  trigger = "both",
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipId = useId();

  const usesHover = trigger === "hover" || trigger === "both";
  const usesFocus = trigger === "focus" || trigger === "both";

  // Esc でクローズ（a11y 必須）
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
      }}
      onMouseEnter={usesHover ? () => setIsOpen(true) : undefined}
      onMouseLeave={usesHover ? () => setIsOpen(false) : undefined}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-expanded={isOpen}
        onFocus={usesFocus ? () => setIsOpen(true) : undefined}
        onBlur={usesFocus ? () => setIsOpen(false) : undefined}
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          border: "none",
          background: `${C.darkGreen}1a`,
          color: C.darkGreen,
          fontSize: 10,
          fontWeight: 700,
          fontStyle: "italic",
          fontFamily: "'Georgia', 'Times New Roman', serif",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "help",
          padding: 0,
        }}
      >
        i
      </button>
      {isOpen && (
        <div
          id={tooltipId}
          role="tooltip"
          style={{
            position: "absolute",
            zIndex: 50,
            background: "#fff",
            border: `1px solid ${C.paleGreen}66`,
            borderRadius: 10,
            padding: "10px 20px",
            boxShadow: "0 6px 24px rgba(0,0,0,0.12)",
            fontSize: 12,
            lineHeight: 1.6,
            color: C.textDark,
            fontWeight: 400,
            width: maxWidth,
            maxWidth: "90vw",
            ...placementStyle(placement),
          }}
        >
          {title && (
            <strong
              style={{
                display: "block",
                marginBottom: 4,
                color: C.darkGreen,
                fontWeight: 600,
              }}
            >
              {title}
            </strong>
          )}
          {children}
        </div>
      )}
    </span>
  );
}
