/**
 * 京都銀行 CSV パーサー
 *
 * 入力フォーマット (実 CSV ヘッダー検証済, 全銀協 13 列形式):
 *   "照会口座","番号","勘定日","（起算日）","出金金額（円）","入金金額（円）",
 *   "小切手区分","残高（円）","取引区分","明細区分","金融機関名","支店名","摘要"
 *
 * 同形式 (全銀協 13 列) の他 CSV:
 *   - みずほリンクサポート短期間 CSV (列 4/5 が "出金（円）" / "入金（円）" と「金額」抜きの命名差異)
 *   - 本パーサーで両方対応 (HEADER_PATTERN を緩和)
 *
 * 仕様:
 *   - エンコーディング: Shift-JIS (CP932)
 *   - 改行: CRLF
 *   - 全フィールドダブルクォート囲み (RFC 4180)
 *   - 13 列
 *   - 数値は 3 桁カンマ区切り ("7,025,283" → 7025283)
 *   - 日付は漢字形式 ("2026年04月01日")
 *   - お引出金額(col 4) = 出金, お預入金額(col 5) = 入金
 *   - 取引区分(col 8) = "出金" / "入金" (補助情報)
 *   - 残高は毎行記録
 *
 * 備考:
 *   - 京都ヒュアラン口座は 2 ヶ月分のみ (システム制限, 2026/03/09 〜 2026/05/07)
 *   - 取引が月 1-2 件と少ない (EB 手数料 / ご返済 / 貸付利息)
 */

import iconv from "iconv-lite";
import type {
  BankKind,
  ParseResult,
  ParsedBankRow,
  ParseWarning,
} from "./types";
import { BankParserError } from "./types";
import {
  parseCsvRfc4180,
  parseGroupedNumber,
  parseKanjiDate,
} from "./csv-utils";

const BANK_KIND: BankKind = "kyoto";

/** 京都 CSV の列インデックス (0-based) */
const COL = {
  // 営業店=0, 番号=1,
  DATE: 2,
  // 年センター=3,
  WITHDRAWAL: 4,
  DEPOSIT: 5,
  // 入支出区分=6,
  BALANCE: 7,
  // 取引区分=8, 明細区分=9, 金融機関名=10, 支店名=11,
  DESCRIPTION: 12,
} as const;

// 実 CSV: "照会口座","番号","勘定日","（起算日）","出金金額（円）","入金金額（円）"
// 防御的に旧呼称 (営業店 / お取引日 / お引出金額 / お預入金額) も許容
// みずほ短期間 CSV ("出金（円）","入金（円）" - 金額省略) も許容
const HEADER_PATTERN =
  /(?:照会口座|営業店).*(?:勘定日|お取引日).*(?:出金(?:金額)?|お引出金額).*(?:入金(?:金額)?|お預入金額)/;

export interface KyotoParseOptions {
  strict?: boolean;
}

export function parseKyotoCsv(
  buf: Buffer,
  options: KyotoParseOptions = {},
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
        "京都 CSV: ヘッダー行が見つかりません",
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

  let openingBalance: number | null = null;
  let openingBalanceDerivation: ParseResult["opening_balance_derivation"] = null;
  let closingBalance: number | null = null;

  for (let i = headerLineNumber; i < allRows.length; i++) {
    const lineNo = i + 1;
    const cols = allRows[i];
    if (cols.length === 0 || (cols.length === 1 && cols[0] === "")) continue;

    if (cols.length < 13) {
      warnings.push({
        line_number: lineNo,
        raw_line: cols.join(","),
        reason: `列数不足 (${cols.length} 列, 最低 13 必要)`,
      });
      continue;
    }

    const transactionDate = parseKanjiDate(cols[COL.DATE]);
    if (transactionDate === null) {
      warnings.push({
        line_number: lineNo,
        raw_line: cols.join(","),
        reason: `日付が不正 (${cols[COL.DATE]})`,
      });
      continue;
    }

    const withdrawalRaw = cols[COL.WITHDRAWAL].trim();
    const depositRaw = cols[COL.DEPOSIT].trim();
    const balanceRaw = cols[COL.BALANCE].trim();
    const description = cols[COL.DESCRIPTION];

    const withdrawalNum = withdrawalRaw === "" ? null : parseGroupedNumber(withdrawalRaw);
    const depositNum = depositRaw === "" ? null : parseGroupedNumber(depositRaw);

    if (withdrawalNum === null && depositNum === null) {
      warnings.push({
        line_number: lineNo,
        raw_line: cols.join(","),
        reason: `お引出/お預入 が両方空または不正 (出金=${withdrawalRaw}, 入金=${depositRaw})`,
      });
      continue;
    }
    if (withdrawalNum !== null && depositNum !== null) {
      warnings.push({
        line_number: lineNo,
        raw_line: cols.join(","),
        reason: `お引出/お預入 が両方値を持つ (どちらか一方であるべき)`,
      });
      continue;
    }

    const isWithdrawal = withdrawalNum !== null;
    const amount = isWithdrawal ? (withdrawalNum as number) : (depositNum as number);
    const flow = isWithdrawal ? "withdrawal" : "deposit";

    const balance = parseGroupedNumber(balanceRaw);

    rows.push({
      transaction_date: transactionDate,
      amount,
      flow,
      description,
      balance_after: balance,
      source_line_number: lineNo,
    });

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
