/**
 * Garden-Bud / 全銀協 CSV — Shift-JIS エンコード
 *
 * 全銀協フォーマットは Shift-JIS 固定。Node.js 標準の TextEncoder は UTF-8 のみの
 * ため、iconv-lite ライブラリを経由してエンコードする。
 */

import iconv from "iconv-lite";

export function encodeToShiftJis(text: string): Buffer {
  return iconv.encode(text, "Shift_JIS");
}
