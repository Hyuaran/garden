/**
 * Garden Forest — テーマ定数
 *
 * Forest モジュール固有の見た目を定義する定数オブジェクト。
 * 背景はウォームベージュ系グラデーション（Tree と共通）、
 * ヘッダーバーやバッジはグリーン系アクセントを使用。
 *
 * カラー値は _constants/colors.ts の C オブジェクトから参照。
 * インラインスタイルで使用することを想定しており、
 * Tailwind CSS クラスには直接対応しない。
 */

import { C } from "./colors";

/** Forest テーマ定数オブジェクト */
export const FOREST_THEME = {
  /** 全画面共通の背景グラデーション（ウォームベージュ 3 色） */
  background: `linear-gradient(160deg, ${C.bgWarm1} 0%, ${C.bgWarm2} 50%, ${C.bgWarm3} 100%)`,

  /** ログイン画面の背景グラデーション（グリーン系） */
  loginBackground: `linear-gradient(160deg, ${C.darkGreen} 0%, ${C.midGreen} 50%, ${C.lightGreen} 100%)`,

  /** ガラスパネルの背景色 */
  panelBg: "rgba(255,255,255,0.75)",

  /** ガラスパネルのボーダー色 */
  panelBorder: "rgba(255,255,255,0.8)",

  /** ガラスパネルのシャドウ */
  panelShadow: "0 4px 24px rgba(0,0,0,0.08)",

  /** ガラスパネルの角丸（px） */
  panelRadius: 20,

  /** 本文テキスト（主） */
  textPrimary: C.textDark,

  /** 補助テキスト */
  textSecondary: C.textSub,

  /** ミュートテキスト */
  textMuted: C.textMuted,

  /** ヘッダーバーのグラデーション（グリーン系横グラデーション） */
  headerBar: `linear-gradient(90deg, ${C.darkGreen} 0%, ${C.midGreen} 100%)`,

  /** 進行期バッジの背景色（ゴールドダーク） */
  shinkouBadge: C.goldDark,

  /** 増加・プラス表示色 */
  positive: C.arrowUp,

  /** 減少・マイナス表示色 */
  negative: C.arrowDown,
} as const;
