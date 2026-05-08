/**
 * Garden-Bud / 全銀協 CSV — トレーラレコード（種別 8）
 *
 * 仕様（120 byte）:
 *   位置    桁数  項目
 *   0       1    レコード種別 = "8"
 *   1-6     6    合計件数（右寄せ 0 埋め）
 *   7-18    12   合計金額（右寄せ 0 埋め）
 *   19-119  101  ダミー（空白）
 */

import { padLeftZero } from "../padding";

export function buildTrailerRecord(
  recordCount: number,
  totalAmount: number,
): string {
  const parts: string[] = [
    "8",
    padLeftZero(recordCount.toString(), 6),
    padLeftZero(totalAmount.toString(), 12),
    " ".repeat(101),
  ];
  const record = parts.join("");

  if (record.length !== 120) {
    throw new Error(
      `トレーラレコード長が 120 byte ではありません: ${record.length}`,
    );
  }

  return record;
}
