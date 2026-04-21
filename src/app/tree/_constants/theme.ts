/**
 * Garden-Tree テーマ定義（ライト／ダーク）
 *
 * 現段階ではライトモード固定で ACTIVE_THEME = LIGHT_THEME。
 * 将来的に ThemeContext を導入してユーザーが切り替えられるようにする予定。
 *
 * 切替方針（将来実装時の想定）:
 *   - 初期値はシステム設定 (prefers-color-scheme) or localStorage
 *   - 切替ボタンは KPIヘッダー右上 or マイページに配置
 *   - ビビッドカラー (_constants/colors.ts の C) は両テーマで共有し、
 *     背景・ガラスパネル・基本テキスト色のみここで切り替える
 *   - グローバルスコープで CSS カスタムプロパティ (--bg / --fg など) に
 *     書き出す案と、Provider + props でインラインに渡す案があり要検討
 *
 * 現時点では DARK_THEME は値の暫定プレースホルダ。
 * 本格対応時にデザインと合わせて再定義する。
 */

import { C } from "./colors";

export type ThemeMode = "light" | "dark";

export type TreeTheme = {
  mode: ThemeMode;
  /** /tree 配下の全画面共通の背景（線形グラデーション想定） */
  background: string;
  /** ガラスパネルの背景 */
  panel: string;
  /** ガラスパネルのボーダー色 */
  panelBorder: string;
  /** 本文テキスト（主） */
  textPrimary: string;
  /** 補助テキスト */
  textSecondary: string;
};

/**
 * ライトモード（現プロトタイプの見た目を忠実に再現）
 *
 * 背景は Forest と揃えたウォームベージュ 3 色グラデーション。
 */
export const LIGHT_THEME: TreeTheme = {
  mode: "light",
  background: `linear-gradient(160deg, ${C.bgWarm1} 0%, ${C.bgWarm2} 50%, ${C.bgWarm3} 100%)`,
  panel: "rgba(255,255,255,0.75)",
  panelBorder: "rgba(255,255,255,0.8)",
  textPrimary: C.textDark,
  textSecondary: C.textSub,
};

/**
 * ダークモード（将来実装・暫定値）
 *
 * デザイン未確定のためプレースホルダ。
 * - 背景: 濃いめのグリーン〜ブラックのグラデーション
 * - パネル: 半透明の暗色（グリーン寄り）
 * - テキスト: 明るめのグリーンホワイト系
 */
export const DARK_THEME: TreeTheme = {
  mode: "dark",
  background: "linear-gradient(160deg, #0f1e14 0%, #1a2d20 50%, #0f1e14 100%)",
  panel: "rgba(20,35,25,0.55)",
  panelBorder: "rgba(255,255,255,0.06)",
  textPrimary: "#eef7ee",
  textSecondary: "#a8c2b0",
};

/**
 * 現在アクティブなテーマ。
 * 将来的には useTreeTheme() 等のフックで差し替える。
 */
export const ACTIVE_THEME: TreeTheme = LIGHT_THEME;
