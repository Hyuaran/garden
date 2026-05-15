/**
 * 弥生インポート CSV パーサー (A 案 過去 1 年取込用)
 *
 * 入力フォーマット (元 Python 5_仕訳帳_弥生変換_v7.py 出力形式):
 *   - エンコーディング: Shift-JIS (CP932)
 *   - 改行: CRLF
 *   - ヘッダーなし
 *   - 25 列, comma-separated, クォートなし
 *   - 全行同じ列数 (25 列均一)
 *
 * 用途:
 *   - 過去 1 年 (2025/4/1 〜 2026/3/31) の弥生インポート CSV を読み込み
 *   - bud_transactions に status='ok' として import
 *   - balance-overview の月次推移データ充実化
 *
 * カラム:
 *   col 0:  2000 (固定)
 *   col 1:  伝票番号 (1-based)
 *   col 2:  empty
 *   col 3:  伝票日付 (YYYY/M/D)
 *   col 4:  借方勘定科目
 *   col 5:  借方補助科目 (optional)
 *   col 6:  empty
 *   col 7:  借方税区分
 *   col 8:  借方金額
 *   col 9:  借方消費税額
 *   col 10: 貸方勘定科目
 *   col 11: 貸方補助科目 (optional)
 *   col 12: empty
 *   col 13: 貸方税区分
 *   col 14: 貸方金額
 *   col 15: 貸方消費税額
 *   col 16: 摘要
 *   col 17-23: empty / 0
 *   col 24: "no"
 *
 * 注意:
 *   - 弥生 CSV はクォートなしだが、実 fixture (1,682 行) で全 25 列均一を確認済
 *   - 摘要 (col 16) にカンマは含まれない (元 Python 出力時点で除去 or 含まない仕様)
 *   - 防御的に摘要内カンマがある場合は最初の 16 カンマで split + 最後の "no" まで結合
 */

import iconv from "iconv-lite";
import type { YayoiImportRow, YayoiParseResult, ParseWarning } from "../../types";
import { BankParserError } from "../../types";

/** 弥生 CSV の列インデックス */
const COL = {
  IDENTIFIER: 0,
  DENPYO_NO: 1,
  // empty: 2
  DATE: 3,
  DEBIT_ACCOUNT: 4,
  DEBIT_SUB_ACCOUNT: 5,
  // empty: 6
  DEBIT_TAX_CLASS: 7,
  DEBIT_AMOUNT: 8,
  DEBIT_TAX_AMOUNT: 9,
  CREDIT_ACCOUNT: 10,
  CREDIT_SUB_ACCOUNT: 11,
  // empty: 12
  CREDIT_TAX_CLASS: 13,
  CREDIT_AMOUNT: 14,
  CREDIT_TAX_AMOUNT: 15,
  DESCRIPTION: 16,
  // empty/0: 17-23
  YES_NO: 24,
} as const;

const EXPECTED_COL_COUNT = 25;
const EXPECTED_IDENTIFIER = "2000";

export interface YayoiImportParseOptions {
  /** strict mode: 不正行で throw (default: false, warning に記録して skip) */
  strict?: boolean;
}

/**
 * 弥生インポート CSV (Shift-JIS Buffer) をパースする。
 *
 * @param buf 弥生 CSV のバイナリ
 * @param options パースオプション
 * @returns パース結果 (取引行配列 + メタ情報)
 */
export function parseYayoiImportCsv(
  buf: Buffer,
  options: YayoiImportParseOptions = {},
): YayoiParseResult {
  const strict = options.strict ?? false;

  // Shift-JIS デコード
  const text = iconv.decode(buf, "Shift_JIS");
  const rawLines = text.split(/\r\n|\r|\n/);

  const warnings: ParseWarning[] = [];
  const rows: YayoiImportRow[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const lineNo = i + 1;
    const raw = rawLines[i];
    if (raw == null || raw.trim() === "") continue;

    const cols = raw.split(",");
    if (cols.length !== EXPECTED_COL_COUNT) {
      const msg = `列数が ${EXPECTED_COL_COUNT} ではない (${cols.length} 列)`;
      if (strict) {
        throw new BankParserError(`弥生 CSV: ${msg}`, lineNo, raw);
      }
      warnings.push({ line_number: lineNo, raw_line: raw, reason: msg });
      continue;
    }

    if (cols[COL.IDENTIFIER].trim() !== EXPECTED_IDENTIFIER) {
      const msg = `識別子 (col 0) が "${EXPECTED_IDENTIFIER}" ではない (${cols[COL.IDENTIFIER]})`;
      if (strict) {
        throw new BankParserError(`弥生 CSV: ${msg}`, lineNo, raw);
      }
      warnings.push({ line_number: lineNo, raw_line: raw, reason: msg });
      continue;
    }

    // 伝票番号
    const denpyoNoStr = cols[COL.DENPYO_NO].trim();
    if (!/^\d+$/.test(denpyoNoStr)) {
      warnings.push({
        line_number: lineNo,
        raw_line: raw,
        reason: `伝票番号が不正 (${denpyoNoStr})`,
      });
      continue;
    }
    const denpyoNo = Number(denpyoNoStr);

    // 伝票日付 (YYYY/M/D → YYYY-MM-DD)
    const dateRaw = cols[COL.DATE].trim();
    const transactionDate = parseYayoiDate(dateRaw);
    if (transactionDate === null) {
      warnings.push({
        line_number: lineNo,
        raw_line: raw,
        reason: `伝票日付が不正 (${dateRaw})`,
      });
      continue;
    }

    // 借方/貸方 金額
    const debitAmount = parseNonNegativeInt(cols[COL.DEBIT_AMOUNT]);
    const debitTaxAmount = parseNonNegativeInt(cols[COL.DEBIT_TAX_AMOUNT]);
    const creditAmount = parseNonNegativeInt(cols[COL.CREDIT_AMOUNT]);
    const creditTaxAmount = parseNonNegativeInt(cols[COL.CREDIT_TAX_AMOUNT]);

    if (
      debitAmount === null ||
      debitTaxAmount === null ||
      creditAmount === null ||
      creditTaxAmount === null
    ) {
      warnings.push({
        line_number: lineNo,
        raw_line: raw,
        reason: `金額が不正 (借方=${cols[COL.DEBIT_AMOUNT]}, 貸方=${cols[COL.CREDIT_AMOUNT]})`,
      });
      continue;
    }

    rows.push({
      denpyo_no: denpyoNo,
      transaction_date: transactionDate,
      debit_account: cols[COL.DEBIT_ACCOUNT],
      debit_sub_account: cols[COL.DEBIT_SUB_ACCOUNT],
      debit_tax_class: cols[COL.DEBIT_TAX_CLASS],
      debit_amount: debitAmount,
      debit_tax_amount: debitTaxAmount,
      credit_account: cols[COL.CREDIT_ACCOUNT],
      credit_sub_account: cols[COL.CREDIT_SUB_ACCOUNT],
      credit_tax_class: cols[COL.CREDIT_TAX_CLASS],
      credit_amount: creditAmount,
      credit_tax_amount: creditTaxAmount,
      description: cols[COL.DESCRIPTION],
      source_line_number: lineNo,
    });
  }

  // 期間計算
  let dateRange: YayoiParseResult["date_range"] = null;
  if (rows.length > 0) {
    const dates = rows.map((r) => r.transaction_date).sort();
    dateRange = { from: dates[0], to: dates[dates.length - 1] };
  }

  return {
    rows,
    warnings,
    row_count: rows.length,
    date_range: dateRange,
  };
}

// ----------------------------------------------------------------
// 内部ヘルパー
// ----------------------------------------------------------------

/**
 * 弥生日付 (YYYY/M/D or YYYY/MM/DD) を YYYY-MM-DD に変換。
 *
 * 例:
 *   "2025/4/1"   → "2025-04-01"
 *   "2026/03/31" → "2026-03-31"
 */
export function parseYayoiDate(s: string): string | null {
  const trimmed = s.trim();
  if (trimmed === "") return null;
  const m = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const y = m[1];
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * 非負整数文字列をパース (空文字 → 0, 不正 → null)。
 */
export function parseNonNegativeInt(s: string): number | null {
  const trimmed = s.trim();
  if (trimmed === "") return 0;
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}
