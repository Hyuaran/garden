/**
 * Garden Forest — カラーパレット
 *
 * Garden シリーズ共通のブランドカラーを Forest モジュール内で定義。
 * Forest は Tree に依存せず自己完結する（モジュール単体抽出に対応）。
 *
 * 将来的に共有パッケージ（@garden/colors 等）に集約する可能性があるが、
 * 現段階では各モジュールが同じ値を独立して保持する。
 */

export const C = {
  // Green 系（基調カラー）
  darkGreen: "#1b4332",
  midGreen: "#2d6a4f",
  lightGreen: "#40916c",
  accentGreen: "#52b788",
  paleGreen: "#74c69d",
  mintBg: "#d8f3dc",

  // Warm 背景色
  bgWarm1: "#f6f1e7",
  bgWarm2: "#eaf0e3",
  bgWarm3: "#f0ece2",

  // テキストカラー
  textDark: "#2c3e2c",
  textSub: "#5a7a5a",
  textMuted: "#7a9a7a",

  // 達成カラー
  gold: "#c9a84c",
  goldDark: "#b8860b",
  red: "#d63031",
  softRed: "#e07a7a",

  // ベース
  white: "#fff",

  // 比較矢印
  arrowUp: "#3478c6",
  arrowDown: "#c44a4a",
  arrowFlat: "#c49a20",
} as const;

export type ColorKey = keyof typeof C;
export type ColorValue = (typeof C)[ColorKey];
