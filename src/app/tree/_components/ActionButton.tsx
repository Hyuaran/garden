"use client";

/**
 * Garden-Tree アクションボタン
 *
 * プロトタイプの <ActionButton /> をそのまま移植。
 * ログイン画面やダッシュボードの「打刻・ログイン」など
 * 主要アクションで使う角丸ボタン（ホバーで微浮き上がり）。
 */

import type { MouseEvent, ReactNode } from "react";
import { C } from "../_constants/colors";

type ActionButtonProps = {
  label: string;
  color?: string;
  textColor?: string;
  onClick?: () => void;
  large?: boolean;
  icon?: ReactNode;
  type?: "button" | "submit";
  disabled?: boolean;
};

export function ActionButton({
  label,
  color = C.midGreen,
  textColor = C.white,
  onClick,
  large,
  icon,
  type = "button",
  disabled = false,
}: ActionButtonProps) {
  const handleEnter = (e: MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    e.currentTarget.style.transform = "translateY(-2px)";
  };
  const handleLeave = (e: MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = "translateY(0)";
  };

  // グラデーション指定時もシャドウ色が破綻しないよう #hex 以外はフォールバック
  const shadowColor = color.startsWith("#") ? `${color}33` : "rgba(27,67,50,0.2)";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={{
        padding: large ? "16px 48px" : "12px 32px",
        fontSize: large ? 18 : 15,
        fontWeight: 700,
        background: color,
        color: textColor,
        border: "none",
        borderRadius: 14,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "all 0.2s ease",
        fontFamily: "'Noto Sans JP', sans-serif",
        boxShadow: `0 4px 16px ${shadowColor}`,
        display: "flex",
        alignItems: "center",
        gap: 8,
        justifyContent: "center",
      }}
    >
      {icon && <span>{icon}</span>}
      {label}
    </button>
  );
}
