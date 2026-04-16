/**
 * Garden-Tree カラーパレット
 *
 * プロトタイプ GardenLeafV5_v6.jsx の C オブジェクトを TypeScript 化。
 * Gardenシリーズ全体で使用するブランドカラー（Garden-Forest 由来）。
 *
 * 将来的に Tailwind CSS 4 のテーマ変数に移行することを検討するが、
 * 現段階ではインラインスタイル/React props 経由で参照する。
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
  gold: "#c9a84c",      // 当日目標達成
  goldDark: "#b8860b",  // ゴールドアクセント
  red: "#d63031",       // 月間目標達成
  softRed: "#e07a7a",   // 赤アクセント

  // ベース
  white: "#fff",

  // 比較矢印
  arrowUp: "#3478c6",
  arrowDown: "#c44a4a",
  arrowFlat: "#c49a20",
} as const;

export type ColorKey = keyof typeof C;
export type ColorValue = (typeof C)[ColorKey];
