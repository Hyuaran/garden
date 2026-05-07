/**
 * PayPay 銀行 CSV パーサー
 *
 * 入力フォーマット (実 CSV ヘッダー):
 *   "取引日(年)","取引日(月)","取引日(日)","操作時刻(時)","操作時刻(分)","操作時刻(秒)",
 *   "取引先番号","摘要","お支払金額","お預り金額","残高","備考"
 *
 * 仕様:
 *   - エンコーディング: Shift-JIS (CP932)
 *   - 改行: CRLF
 *   - 全フィールドダブルクォート囲み (RFC 4180)
 *   - 12 列
 *   - 数値はカンマ無し ("2000000" → 2000000)
 *   - お支払金額 = 出金 (withdrawal), お預り金額 = 入金 (deposit)
 *   - 残高は毎行記録
 *
 * 備考:
 *   - PayPay ヒュアラン口座は CSV 出力不可 (システム障害)
 *     → has_csv=false で B-min 対象外。本パーサーは PayPay センターライズのみ実用。
 */

import iconv from "iconv-lite";
import type {
  BankKind,
  ParseResult,
  ParsedBankRow,
  ParseWarning,
} from "../../types";
import { BankParserError } from "../../types";
import { parseCsvRfc4180 } from "../../csv-utils";

const BANK_KIND: BankKind = "paypay";

/** PayPay CSV の列インデックス (0-based) */
const COL = {
  YEAR: 0,
  MONTH: 1,
  DAY: 2,
  // 時=3, 分=4, 秒=5, 取引先番号=6,
  DESCRIPTION: 7,
  WITHDRAWAL: 8,
  DEPOSIT: 9,
  BALANCE: 10,
  // 備考=11,
} as const;

const HEADER_PATTERN = /取引日.*年.*取引日.*月.*取引日.*日/;

export interface PayPayParseOptions {
  strict?: boolean;
}

export function parsePayPayCsv(
  buf: Buffer,
  options: PayPayParseOptions = {},
): ParseResult {
  const strict = options.strict ?? true;
  const text = iconv.decode(buf, "Shift_JIS");
  const allRows = parseCsvRfc4180(text);

  const warnings: ParseWarning[] = [];
  const rows: ParsedBankRow[] = [];

  // ヘッダー検出
  let headerLineNumber = -1;
  for (let i = 0; i < allRows.length; i++) {
    const joined = allRows[i].join(",");
    if (HEADER_PATTERN.test(joined)) {
      headerLineNumber = i + 1;
      break;
    }
  }
  if (headerLineNumber === -1) {
    if (strict) {
      throw new BankParserError(
        "PayPay CSV: ヘッダー行が見つかりません",
        null,
        allRows[0]?.join(",") ?? null,
      );
    }
    warnings.push({
      line_number: 1,
      raw_line: allRows[0]?.join(",") ?? "",
      reason: "ヘッダー行が見つからず、全行をデータとして扱う",
    });
    headerLineNumber = 0;
  }

  // データ行 (header の次から)
  let openingBalance: number | null = null;
  let openingBalanceDerivation: ParseResult["opening_balance_derivation"] = null;
  let closingBalance: number | null = null;

  for (let i = headerLineNumber; i < allRows.length; i++) {
    const lineNo = i + 1;
    const cols = allRows[i];
    if (cols.length === 0 || (cols.length === 1 && cols[0] === "")) continue;

    if (cols.length < 11) {
      warnings.push({
        line_number: lineNo,
        raw_line: cols.join(","),
        reason: `列数不足 (${cols.length} 列, 最低 11 必要)`,
      });
      continue;
    }

    const yearStr = cols[COL.YEAR].trim();
    const monthStr = cols[COL.MONTH].trim();
    const dayStr = cols[COL.DAY].trim();

    if (
      !/^\d{4}$/.test(yearStr) ||
      !/^\d{1,2}$/.test(monthStr) ||
      !/^\d{1,2}$/.test(dayStr)
    ) {
      warnings.push({
        line_number: lineNo,
        raw_line: cols.join(","),
        reason: `日付が不正 (年=${yearStr}, 月=${monthStr}, 日=${dayStr})`,
      });
      continue;
    }
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      warnings.push({
        line_number: lineNo,
        raw_line: cols.join(","),
        reason: `月日が範囲外 (月=${month}, 日=${day})`,
      });
      continue;
    }

    const withdrawalStr = cols[COL.WITHDRAWAL].trim();
    const depositStr = cols[COL.DEPOSIT].trim();
    const balanceStr = cols[COL.BALANCE].trim();
    const description = cols[COL.DESCRIPTION];

    const isWithdrawal = withdrawalStr !== "";
    const isDeposit = depositStr !== "";
    if (isWithdrawal === isDeposit) {
      warnings.push({
        line_number: lineNo,
        raw_line: cols.join(","),
        reason: `お支払/お預り の状態が不正 (出金=${withdrawalStr}, 入金=${depositStr})`,
      });
      continue;
    }

    const amountStr = isWithdrawal ? withdrawalStr : depositStr;
    if (!/^\d+$/.test(amountStr)) {
      warnings.push({
        line_number: lineNo,
        raw_line: cols.join(","),
        reason: `金額が不正 (${amountStr})`,
      });
      continue;
    }
    const amount = Number(amountStr);
    const flow = isWithdrawal ? "withdrawal" : "deposit";

    // 残高
    let balance: number | null = null;
    if (balanceStr !== "" && /^\d+$/.test(balanceStr)) {
      balance = Number(balanceStr);
    }

    rows.push({
      transaction_date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      amount,
      flow,
      description,
      balance_after: balance,
      source_line_number: lineNo,
    });

    // 期初残高: 1 行目残高 - 1 行目入出金額 (符号付) で逆算
    if (openingBalance === null && balance !== null) {
      const signedAmount = isWithdrawal ? -amount : amount;
      openingBalance = balance - signedAmount;
      openingBalanceDerivation = "csv_first_row_back_calculation";
    }
    if (balance !== null) closingBalance = balance;
  }

  return {
    bank_kind: BANK_KIND,
    rows,
    header_line_number: headerLineNumber,
    opening_balance: openingBalance,
    closing_balance: closingBalance,
    opening_balance_derivation: openingBalanceDerivation,
    warnings,
  };
}
