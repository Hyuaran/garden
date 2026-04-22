/**
 * Garden-Bud / 全銀協 CSV — データレコード（種別 2）
 *
 * 仕様（120 byte 固定長、半角、全銀協 V1 の最も一般的なレイアウト）:
 *   位置      桁数  累計  項目
 *   0         1     1    レコード種別コード = "2"
 *   1-4       4     5    振込先金融機関コード
 *   5-19      15    20   振込先金融機関名（任意、空白埋め）
 *   20-22     3     23   振込先支店コード
 *   23-37     15    38   振込先支店名（任意、空白埋め）
 *   38-41     4     42   手形交換所番号（空白埋め）
 *   42        1     43   預金種目
 *   43-49     7     50   口座番号（0 埋め）
 *   50-79     30    80   受取人名（左詰め、右空白埋め）
 *   80-89     10    90   振込金額（右寄せ 0 埋め）
 *   90        1     91   新規コード = "0"
 *   91-100    10    101  顧客コード1（空白埋め）
 *   101-110   10    111  顧客コード2（空白埋め）
 *   111-118   8     119  EDI情報/摘要（左詰め、右空白埋め、8桁超は切詰）
 *   119       1     120  振替区分 = "0"
 */

import type { ZenginTransferInput } from "../types";
import { toHalfWidthKana } from "../kana-converter";

function padRight(s: string, length: number): string {
  if (s.length > length) return s.substring(0, length);
  return s + " ".repeat(length - s.length);
}

function padLeftZero(s: string, length: number): string {
  if (s.length > length) return s.substring(s.length - length);
  return "0".repeat(length - s.length) + s;
}

export function buildDataRecord(t: ZenginTransferInput): string {
  // 受取人名を半角カタカナに変換
  const { kana } = toHalfWidthKana(t.payee_account_holder_kana);

  // EDI 情報（8 桁まで）
  const ediInfoRaw = t.edi_info ? toHalfWidthKana(t.edi_info).kana : "";
  const ediInfo = ediInfoRaw.substring(0, 8);

  const parts: string[] = [
    "2",                                                  // 0      種別
    padLeftZero(t.payee_bank_code, 4),                    // 1-4    振込先銀行コード
    " ".repeat(15),                                       // 5-19   振込先銀行名（任意、空白）
    padLeftZero(t.payee_branch_code, 3),                  // 20-22  振込先支店コード
    " ".repeat(15),                                       // 23-37  振込先支店名（任意、空白）
    " ".repeat(4),                                        // 38-41  手形交換所番号
    t.payee_account_type,                                 // 42     預金種目
    padLeftZero(t.payee_account_number, 7),               // 43-49  口座番号
    padRight(kana, 30),                                   // 50-79  受取人名
    padLeftZero(t.amount.toString(), 10),                 // 80-89  振込金額
    "0",                                                  // 90     新規コード
    padRight(t.customer_code_1 ?? "", 10),                // 91-100 顧客コード1
    padRight(t.customer_code_2 ?? "", 10),                // 101-110 顧客コード2
    padRight(ediInfo, 8),                                 // 111-118 EDI情報
    "0",                                                  // 119    振替区分
  ];

  const record = parts.join("");

  if (record.length !== 120) {
    throw new Error(
      `データレコード長が 120 byte ではありません: ${record.length}`,
    );
  }

  return record;
}
