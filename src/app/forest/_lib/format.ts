/**
 * Garden Forest — 金額フォーマットユーティリティ
 *
 * v9 プロトタイプの JavaScript 実装を TypeScript に移植。
 * 円金額を読みやすい短縮形式に変換するヘルパー関数を提供する。
 *
 * 使用例:
 *   fmtYen(150000000)  // "1.5\u5104"
 *   fmtYen(50000)      // "5\u4e07"
 *   fmtYen(800)        // "800\u5186"
 *   fmtYen(null)       // "\u2015"
 */

/** 1億 = 100,000,000 */
const ICHI_OKU = 100_000_000;

/** 1万 = 10,000 */
const ICHI_MAN = 10_000;

/**
 * 円金額を短縮表示文字列に変換する。
 *
 * - 1億以上: "X.X\u5104"（億単位、小数1桁）
 * - 1万以上: "X\u4e07"（万単位、整数）
 * - それ以外: "X\u5186"
 * - null / undefined: "\u2015"（ダッシュ）
 *
 * @param v - 金額（円単位）または null / undefined
 * @returns フォーマット済み文字列
 */
export function fmtYen(v: number | null | undefined): string {
  if (v == null) return "\u2015";
  if (Math.abs(v) >= ICHI_OKU) {
    return `${(v / ICHI_OKU).toFixed(1)}\u5104`;
  }
  if (Math.abs(v) >= ICHI_MAN) {
    return `${Math.round(v / ICHI_MAN)}\u4e07`;
  }
  return `${v}\u5186`;
}

/**
 * 日付を日本語表記 `YYYY年M月D日` に変換する。
 *
 * - `null` または epoch 0（プレースホルダー）: `―`（ダッシュ）
 * - 月・日は 0 埋めなし（v9 `update-info` と同一フォーマット）
 *
 * @param d - Date オブジェクトまたは null
 * @returns フォーマット済み文字列
 */
export function fmtDateJP(d: Date | null): string {
  if (!d || d.getTime() === 0) return "\u2015";
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}年${m}月${day}日`;
}

/**
 * 円金額を短縮表示文字列に変換する（円単位は省略）。
 *
 * グラフ軸ラベルなど "円" 単位テキストが不要な箇所での使用を想定。
 * 1万未満の場合は数値のみ（単位なし）を返す。
 *
 * @param v - 金額（円単位）または null / undefined
 * @returns フォーマット済み文字列（円単位テキストなし）
 */
export function fmtYenShort(v: number | null | undefined): string {
  if (v == null) return "\u2015";
  if (Math.abs(v) >= ICHI_OKU) {
    return `${(v / ICHI_OKU).toFixed(1)}\u5104`;
  }
  if (Math.abs(v) >= ICHI_MAN) {
    return `${Math.round(v / ICHI_MAN)}\u4e07`;
  }
  return `${v}`;
}
