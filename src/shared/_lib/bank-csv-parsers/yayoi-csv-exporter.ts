/**
 * 弥生インポート CSV エクスポーター
 *
 * 出力フォーマット (元 Python 5_仕訳帳_弥生変換_v7.py の出力形式に準拠):
 *   - エンコーディング: Shift-JIS (CP932)
 *   - 改行: CRLF
 *   - ヘッダーなし
 *   - 25 列, comma-separated, クォートなし
 *   - BOM なし (Python 出力に揃える)
 *   - 末尾改行あり (CRLF で最終行を閉じる)
 *
 * 用途:
 *   - bud_transactions (status='ok' 確認済) → 弥生インポート CSV 書き出し
 *   - 東海林さんが弥生会計に取込
 *
 * 列構成 (yayoi-import-parser.ts と対称):
 *   col 0:  "2000" (固定識別子)
 *   col 1:  伝票番号 (1-based)
 *   col 2:  empty
 *   col 3:  伝票日付 (YYYY/M/D)
 *   col 4:  借方勘定科目
 *   col 5:  借方補助科目 (省略時は空)
 *   col 6:  empty
 *   col 7:  借方税区分
 *   col 8:  借方金額
 *   col 9:  借方消費税額
 *   col 10: 貸方勘定科目
 *   col 11: 貸方補助科目 (省略時は空)
 *   col 12: empty
 *   col 13: 貸方税区分
 *   col 14: 貸方金額
 *   col 15: 貸方消費税額
 *   col 16: 摘要 (カンマ含む場合は半角空白に置換: 防御的)
 *   col 17-23: empty / 0
 *   col 24: "no" (固定)
 */

import iconv from "iconv-lite";

/** 弥生 CSV エクスポート 1 行の入力 */
export interface YayoiExportRow {
  /** 伝票番号 (省略時は配列の index + 1 を使用) */
  denpyo_no?: number;
  /** 伝票日付 (YYYY-MM-DD, ISO 形式) */
  transaction_date: string;
  /** 借方勘定科目 */
  debit_account: string;
  /** 借方補助科目 (省略可) */
  debit_sub_account?: string;
  /** 借方税区分 (例: "課税仕入 10%" / "対象外") */
  debit_tax_class?: string;
  /** 借方金額 (円, 非負整数) */
  debit_amount: number;
  /** 借方消費税額 (円, 非負整数, 省略時 0) */
  debit_tax_amount?: number;
  /** 貸方勘定科目 */
  credit_account: string;
  /** 貸方補助科目 (省略可) */
  credit_sub_account?: string;
  /** 貸方税区分 */
  credit_tax_class?: string;
  /** 貸方金額 (円, 非負整数) */
  credit_amount: number;
  /** 貸方消費税額 (円, 非負整数, 省略時 0) */
  credit_tax_amount?: number;
  /** 摘要 (カンマ含む場合は半角空白に置換) */
  description: string;
}

export interface YayoiExportOptions {
  /** 末尾改行を付ける (default: true) */
  trailingNewline?: boolean;
}

/**
 * 弥生インポート CSV を Shift-JIS Buffer として生成する。
 *
 * @param rows エクスポート対象行配列
 * @param options エクスポートオプション
 * @returns Shift-JIS エンコード済バイナリ
 */
export function exportYayoiCsv(
  rows: YayoiExportRow[],
  options: YayoiExportOptions = {},
): Buffer {
  const trailingNewline = options.trailingNewline ?? true;

  const lines: string[] = rows.map((row, i) => {
    const denpyoNo = row.denpyo_no ?? i + 1;
    const date = formatYayoiDate(row.transaction_date);
    const desc = sanitizeDescription(row.description);

    const cols = [
      "2000", // 0 identifier
      String(denpyoNo), // 1
      "", // 2
      date, // 3
      row.debit_account, // 4
      row.debit_sub_account ?? "", // 5
      "", // 6
      row.debit_tax_class ?? "", // 7
      String(row.debit_amount), // 8
      String(row.debit_tax_amount ?? 0), // 9
      row.credit_account, // 10
      row.credit_sub_account ?? "", // 11
      "", // 12
      row.credit_tax_class ?? "", // 13
      String(row.credit_amount), // 14
      String(row.credit_tax_amount ?? 0), // 15
      desc, // 16
      "", "", "0", "", "", "", "", // 17-23 (col 19 only is "0")
      "no", // 24
    ];

    return cols.join(",");
  });

  let text = lines.join("\r\n");
  if (trailingNewline && lines.length > 0) {
    text += "\r\n";
  }

  return iconv.encode(text, "Shift_JIS");
}

// ----------------------------------------------------------------
// 内部ヘルパー
// ----------------------------------------------------------------

/**
 * ISO 日付 (YYYY-MM-DD) を 弥生形式 (YYYY/M/D, 1 桁月日対応) に変換。
 *
 * 例:
 *   "2025-04-01" → "2025/4/1"
 *   "2026-12-31" → "2026/12/31"
 *
 * 不正な日付は throw する (エクスポート時は厳格、import 時の warning パターンとは異なる)。
 */
export function formatYayoiDate(isoDate: string): string {
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    throw new Error(
      `弥生 CSV エクスポート: 日付形式が不正 (期待: YYYY-MM-DD, 実際: ${isoDate})`,
    );
  }
  const y = m[1];
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) {
    throw new Error(
      `弥生 CSV エクスポート: 月日が範囲外 (月=${mo}, 日=${d}, 元: ${isoDate})`,
    );
  }
  // 弥生形式は zero-pad なし (1 桁月日)
  return `${y}/${mo}/${d}`;
}

/**
 * 摘要内のカンマを半角空白に置換 (防御的)。
 * 弥生 CSV はクォートなしのため、摘要にカンマがあると列ずれを起こす。
 * 元 Python 出力でも実 fixture 1,682 行は全カンマなしを確認済 (整合性維持)。
 */
export function sanitizeDescription(s: string): string {
  return s.replace(/,/g, " ").replace(/\r?\n/g, " ");
}
