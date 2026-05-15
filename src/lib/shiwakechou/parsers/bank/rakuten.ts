/**
 * 楽天銀行 CSV パーサー
 *
 * 入力フォーマット (実 CSV ヘッダー):
 *   取引日,入出金(円),残高(円),入出金先内容
 *
 * 仕様:
 *   - エンコーディング: Shift-JIS (CP932)
 *   - 改行: CRLF
 *   - ヘッダー: 1 行目
 *   - 取引日: YYYYMMDD (区切り文字なし)
 *   - 入出金: 符号付き整数 (負 = 出金, 正 = 入金, 円単位)
 *   - 残高: 符号付き整数 (取引後残高)
 *   - 入出金先内容: 摘要 (原文, ダブルクォート無し)
 *
 * 摘要にカンマが含まれる可能性は実データを見る限り無いが、
 * 安全のため最初の 3 カンマで分割し、4 列目以降は再結合する。
 *
 * 元 Python: G:\マイドライブ\..._東海林美琴\001_仕訳帳\4_仕訳帳_弥生出力_v11.py
 *           (parse_rakuten_csv 相当)
 */

import iconv from "iconv-lite";
import type {
  BankKind,
  ParseResult,
  ParsedBankRow,
  ParseWarning,
} from "../../types";
import { BankParserError } from "../../types";

const BANK_KIND: BankKind = "rakuten";
const EXPECTED_HEADER_PATTERN = /取引日.*入出金.*残高.*入出金先内容/;

export interface RakutenParseOptions {
  /** デバッグ用: ヘッダー行が見つからない場合に warning ではなく throw する (default: true) */
  strict?: boolean;
}

/**
 * 楽天銀行 CSV (Shift-JIS Buffer) をパースする。
 *
 * @param buf 楽天銀行 CSV のバイナリ (Shift-JIS)
 * @param options パースオプション
 * @returns パース結果 (取引行配列 + メタ情報)
 */
export function parseRakutenCsv(
  buf: Buffer,
  options: RakutenParseOptions = {},
): ParseResult {
  const strict = options.strict ?? true;

  // 1. Shift-JIS デコード (既存 zengin/encoding.ts と統一して "Shift_JIS" 表記)
  const text = iconv.decode(buf, "Shift_JIS");

  // 2. CRLF / LF どちらでも対応 (基本は CRLF)
  const rawLines = text.split(/\r\n|\r|\n/);

  const warnings: ParseWarning[] = [];
  const rows: ParsedBankRow[] = [];

  // 3. ヘッダー行の検出
  let headerLineNumber = -1;
  for (let i = 0; i < rawLines.length; i++) {
    if (EXPECTED_HEADER_PATTERN.test(rawLines[i])) {
      headerLineNumber = i + 1; // 1-based
      break;
    }
  }
  if (headerLineNumber === -1) {
    if (strict) {
      throw new BankParserError(
        `楽天 CSV: ヘッダー行が見つかりません (期待: 取引日,入出金(円),残高(円),入出金先内容)`,
        null,
        rawLines[0] ?? null,
      );
    }
    warnings.push({
      line_number: 1,
      raw_line: rawLines[0] ?? "",
      reason: "ヘッダー行が見つからず、1 行目以降をデータとして扱う",
    });
    headerLineNumber = 0;
  }

  // 4. データ行のパース
  let openingBalance: number | null = null;
  let closingBalance: number | null = null;
  let openingBalanceDerivation: ParseResult["opening_balance_derivation"] = null;

  for (let i = headerLineNumber; i < rawLines.length; i++) {
    const lineNo = i + 1;
    const raw = rawLines[i];
    if (raw == null || raw.trim() === "") continue;

    // カンマ分割: 最初の 3 カンマで切り、4 列目以降を再結合
    const parts = splitFirstN(raw, ",", 3);
    if (parts.length !== 4) {
      warnings.push({
        line_number: lineNo,
        raw_line: raw,
        reason: `カンマ区切りが想定と異なる (${parts.length} 列)`,
      });
      continue;
    }

    const [dateRaw, amountRaw, balanceRaw, descRaw] = parts;

    // 取引日 YYYYMMDD → YYYY-MM-DD
    const transactionDate = parseRakutenDate(dateRaw);
    if (transactionDate == null) {
      warnings.push({
        line_number: lineNo,
        raw_line: raw,
        reason: `取引日が不正 (${dateRaw})`,
      });
      continue;
    }

    // 入出金額 (符号付き)
    const amountSigned = parseSignedInt(amountRaw);
    if (amountSigned == null) {
      warnings.push({
        line_number: lineNo,
        raw_line: raw,
        reason: `入出金額が不正 (${amountRaw})`,
      });
      continue;
    }

    // 残高 (符号付き)
    const balance = parseSignedInt(balanceRaw);
    if (balance == null) {
      warnings.push({
        line_number: lineNo,
        raw_line: raw,
        reason: `残高が不正 (${balanceRaw})`,
      });
      continue;
    }

    const flow = amountSigned >= 0 ? "deposit" : "withdrawal";
    const amount = Math.abs(amountSigned);

    rows.push({
      transaction_date: transactionDate,
      amount,
      flow,
      description: descRaw,
      balance_after: balance,
      source_line_number: lineNo,
    });

    // 期初残高: 1 行目の残高 - 1 行目の入出金額 で逆算
    if (openingBalance === null) {
      openingBalance = balance - amountSigned;
      openingBalanceDerivation = "csv_first_row_back_calculation";
    }
    closingBalance = balance;
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

// ----------------------------------------------------------------
// 内部ヘルパー
// ----------------------------------------------------------------

/**
 * 文字列を最初の n 個の区切り文字で分割し、(n+1) 個の要素を返す。
 * 残りの区切り文字は最後の要素にそのまま含める。
 *
 * 例: splitFirstN("a,b,c,d,e", ",", 3) → ["a", "b", "c", "d,e"]
 */
export function splitFirstN(str: string, sep: string, n: number): string[] {
  const result: string[] = [];
  let rest = str;
  for (let i = 0; i < n; i++) {
    const idx = rest.indexOf(sep);
    if (idx === -1) {
      result.push(rest);
      return result;
    }
    result.push(rest.slice(0, idx));
    rest = rest.slice(idx + sep.length);
  }
  result.push(rest);
  return result;
}

/**
 * YYYYMMDD 文字列を YYYY-MM-DD に変換 (8 桁数字のみ)。
 */
export function parseRakutenDate(s: string): string | null {
  const trimmed = s.trim();
  if (!/^\d{8}$/.test(trimmed)) return null;
  const yyyy = trimmed.slice(0, 4);
  const mm = trimmed.slice(4, 6);
  const dd = trimmed.slice(6, 8);
  // ざっくり検証 (月 1-12, 日 1-31)
  const mn = Number(mm);
  const dn = Number(dd);
  if (mn < 1 || mn > 12 || dn < 1 || dn > 31) return null;
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * 符号付き整数文字列をパース (数字以外 + マイナス符号のみ許容)。
 * 空文字や不正な値の場合は null を返す。
 */
export function parseSignedInt(s: string): number | null {
  const trimmed = s.trim();
  if (trimmed === "") return null;
  if (!/^-?\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n)) return null;
  return n;
}
