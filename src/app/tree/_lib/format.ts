/**
 * Garden-Tree 共通フォーマッタ
 *
 * プロトタイプの P() / PJ() に相当。
 * ポイント表記（小数1桁 + "P"）で統一するためのヘルパー。
 */

/** 数値を "x.xP" 形式の文字列にする（SemiGauge の sub などで使用） */
export const formatPoint = (n: number): string => `${Number(n).toFixed(1)}P`;

/** 既存プロトタイプとの互換エイリアス */
export const P = formatPoint;
