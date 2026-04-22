/**
 * Garden-Bud / 全銀協 CSV — ヘッダレコード（種別 1）
 *
 * 仕様（120 byte 固定長、半角）:
 *   位置    桁数  項目
 *   0       1    レコード種別コード = "1"
 *   1-2     2    種別コード = "21"（総合振込）
 *   3       1    コード区分 = "0"（JIS）
 *   4-13    10   依頼人コード
 *   14-53   40   依頼人名（左詰め、右空白埋め）
 *   54-57   4    振込指定日（MMDD）
 *   58-61   4    振込元金融機関コード
 *   62-76   15   振込元金融機関名（左詰め、右空白埋め）
 *   77-79   3    振込元支店コード
 *   80-94   15   振込元支店名（左詰め、右空白埋め）
 *   95      1    振込元預金種目
 *   96-102  7    振込元口座番号
 *   103-119 17   ダミー（空白）
 */

import type { ZenginSourceAccount } from "../types";

function padRight(s: string, length: number): string {
  if (s.length > length) return s.substring(0, length);
  return s + " ".repeat(length - s.length);
}

function padLeftZero(s: string, length: number): string {
  if (s.length > length) return s.substring(s.length - length);
  return "0".repeat(length - s.length) + s;
}

export function buildHeaderRecord(source: ZenginSourceAccount): string {
  const parts: string[] = [
    "1",                                                  // 0:    種別
    "21",                                                 // 1-2:  総合振込
    "0",                                                  // 3:    JIS
    padLeftZero(source.consignor_code, 10),               // 4-13: 依頼人コード
    padRight(source.consignor_name, 40),                  // 14-53:依頼人名
    source.transfer_date,                                 // 54-57:振込指定日 MMDD
    padLeftZero(source.source_bank_code, 4),              // 58-61:振込元銀行コード
    padRight(source.source_bank_name, 15),                // 62-76:振込元銀行名
    padLeftZero(source.source_branch_code, 3),            // 77-79:振込元支店コード
    padRight(source.source_branch_name, 15),              // 80-94:振込元支店名
    source.source_account_type,                           // 95:   預金種目
    padLeftZero(source.source_account_number, 7),         // 96-102:口座番号
    " ".repeat(17),                                       // 103-119:ダミー
  ];

  const record = parts.join("");

  if (record.length !== 120) {
    throw new Error(
      `ヘッダレコード長が 120 byte ではありません: ${record.length}`,
    );
  }

  return record;
}
