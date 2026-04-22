/**
 * Garden-Tree 共通アイコン
 *
 * プロトタイプの Icons オブジェクト（SVG line style）をそのまま移植。
 * currentColor を使っているため、親要素の color で着色される。
 *
 * 使い方:
 *   import { Icons } from "./_components/Icons";
 *   <div style={{ color: "white" }}>{Icons.dashboard}</div>
 */

import type { CSSProperties, ReactElement } from "react";

export const svgStyle: CSSProperties = {
  width: 20,
  height: 20,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export const Icons: Record<string, ReactElement> = {
  dashboard: (
    <svg viewBox="0 0 24 24" style={svgStyle}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="4" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="11" width="7" height="10" rx="1" />
    </svg>
  ),
  trophy: (
    <svg viewBox="0 0 24 24" style={svgStyle}>
      <path d="M6 9a6 6 0 0 0 12 0V3H6v6z" />
      <path d="M6 5H3v2a4 4 0 0 0 4 4" />
      <path d="M18 5h3v2a4 4 0 0 1-4 4" />
      <path d="M12 15v3" />
      <path d="M8 21h8" />
      <path d="M12 15a2 2 0 0 1-2-2" />
      <circle cx="12" cy="7" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" style={svgStyle}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" style={svgStyle}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  headset: (
    <svg viewBox="0 0 24 24" style={svgStyle}>
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5z" />
      <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5z" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" style={svgStyle}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  clipboard: (
    <svg viewBox="0 0 24 24" style={svgStyle}>
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <line x1="9" y1="10" x2="15" y2="10" />
      <line x1="9" y1="14" x2="15" y2="14" />
      <line x1="9" y1="6" x2="11" y2="6" />
    </svg>
  ),
  help: (
    <svg viewBox="0 0 24 24" style={svgStyle}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  ),
  video: (
    <svg viewBox="0 0 24 24" style={svgStyle}>
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" style={svgStyle}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" style={svgStyle}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
};

export type IconName = keyof typeof Icons;
