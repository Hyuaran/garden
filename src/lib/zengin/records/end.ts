/**
 * Garden-Bud / 全銀協 CSV — エンドレコード（種別 9）
 *
 * 仕様: "9" + 空白 119 桁 = 120 桁
 */

export function buildEndRecord(): string {
  return "9" + " ".repeat(119);
}
