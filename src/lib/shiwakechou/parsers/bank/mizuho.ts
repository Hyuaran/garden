/**
 * みずほ銀行 .api ファイル パーサー
 *
 * 入力フォーマット:
 *   - 拡張子: .api (実態は TSV)
 *   - エンコーディング: Shift-JIS (CP932)
 *   - 改行: CRLF
 *   - タブ区切り
 *   - 1 行目: サービス名 (skip)
 *   - 2 行目: 項目名 ヘッダー (年 / 月 / 日 / 時 / 分 / 依頼人名 / ... / 金額 / 入支出区分 / 摘要 / ...)
 *   - 3 行目: 項目属性 (N/C) (skip)
 *   - 4 行目: 項目長 (skip)
 *   - 5 行目以降: データ行 (先頭が "明細")
 *
 * 各データ行の列インデックス (0-based, 実 .api ファイルで確認済 = Python 移植):
 *   col 0:  type ("明細")
 *   col 1:  月
 *   col 2:  日
 *   col 3:  時
 *   col 4:  分
 *   col 5:  依頼人名 (例: "株式会社ARATA")
 *   col 6:  金融機関名 (例: "みずほ銀行")
 *   col 7:  支店名 (例: "四ツ橋支店")
 *   col 8:  預金番号区分
 *   col 9:  預金科目 (例: "普通")
 *   col 10: 口座番号 (例: "3026280")
 *   col 11: 代替表示
 *   col 12: 出金 (値は "出金" / "入金" のいずれか, 列名が「出金」なのは format 側の命名)
 *   col 13: 店内番号
 *   col 14: 明細区分
 *   col 15: 取扱日付月
 *   col 16: 取扱日付日
 *   col 17: 年戻金月
 *   col 18: 年戻金日
 *   col 19: 金額 (符号なし整数, ゼロパディング)
 *   col 20: 入支出区分
 *   col 21: 摘要
 *   col 22: 税法摘要
 *   col 23: 税法番号
 *   col 24: 業者番号
 *
 * ⚠️ 年情報はデータ行には無い (年=列はそもそも存在しない)。
 *   ファイル名から start_year / end_year を推論し、
 *   月の単調性 (前月 > 今月 = 年跨ぎ) で year を割当てる。
 *
 * ⚠️ みずほ .api には残高列が無い (balance_after = null)。
 *   期初残高は 4/30 手入力残高 - 1 年分入出金累計 で別途逆算する。
 *
 * ⚠️ 年情報がデータ行に無いため、ファイル名から start_year / end_year を推論し、
 *   月の単調性 (前月 > 今月 = 年跨ぎ) で year を割当てる。
 *
 * 元 Python: G:\マイドライブ\..._東海林美琴\001_仕訳帳\4_仕訳帳_弥生出力_v11.py
 *           read_api_mizuho() + read_bank_file() の .api 分岐
 */

import iconv from "iconv-lite";
import type {
  BankKind,
  ParseResult,
  ParsedBankRow,
  ParseWarning,
} from "../../types";
import { BankParserError } from "../../types";

const BANK_KIND: BankKind = "mizuho";

/** みずほ .api の列インデックス (Python 移植, 実 .api 検証済) */
const COL = {
  TYPE: 0,
  MONTH: 1,
  DAY: 2,
  // 時=3, 分=4, 依頼人名=5, 金融機関名=6, 支店名=7, 預金番号区分=8,
  // 預金科目=9, 口座番号=10, 代替表示=11,
  TRANSACTION_KIND: 12, // "出金" / "入金"
  // 店内番号=13, 明細区分=14, 取扱日付月=15, 取扱日付日=16, 年戻金月=17, 年戻金日=18,
  AMOUNT: 19,
  // 入支出区分=20,
  DESCRIPTION: 21,
} as const;

export interface MizuhoFilenamePeriod {
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
  endDay: number | null;
}

export interface MizuhoParseOptions {
  /** ファイル名から推論した期間 (年跨ぎ判定に使用) */
  period: MizuhoFilenamePeriod;
  /** デバッグ用 strict mode (default: true) */
  strict?: boolean;
}

/**
 * みずほ .api パース。
 *
 * @param buf .api ファイルのバイナリ (Shift-JIS, TSV)
 * @param options 期間情報 + パースオプション
 */
export function parseMizuhoApi(
  buf: Buffer,
  options: MizuhoParseOptions,
): ParseResult {
  const strict = options.strict ?? true;
  const { period } = options;

  const text = iconv.decode(buf, "Shift_JIS");
  const rawLines = text.split(/\r\n|\r|\n/);

  const warnings: ParseWarning[] = [];
  const rows: ParsedBankRow[] = [];

  // ヘッダー行 (項目名) の検出 (cols[0] === "項目名")
  let headerLineNumber = -1;
  for (let i = 0; i < rawLines.length; i++) {
    const cols = rawLines[i].split("\t");
    if (cols[COL.TYPE] === "項目名") {
      headerLineNumber = i + 1;
      break;
    }
  }
  if (headerLineNumber === -1 && strict) {
    throw new BankParserError(
      "みずほ .api: 項目名ヘッダー行が見つかりません",
      null,
      rawLines[0] ?? null,
    );
  }

  // データ行のパース (cols[0] === "明細")
  let prevMonth: number | null = null;
  let currentYear = period.startYear;

  for (let i = 0; i < rawLines.length; i++) {
    const lineNo = i + 1;
    const raw = rawLines[i];
    if (raw.trim() === "") continue;

    const cols = raw.split("\t");
    if (cols[COL.TYPE] !== "明細") continue;

    // 月 / 日
    const monthStr = (cols[COL.MONTH] ?? "").trim();
    const dayStr = (cols[COL.DAY] ?? "").trim();
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);
    if (
      !Number.isInteger(month) || month < 1 || month > 12 ||
      !Number.isInteger(day) || day < 1 || day > 31
    ) {
      warnings.push({
        line_number: lineNo,
        raw_line: raw,
        reason: `月/日が不正 (月=${monthStr}, 日=${dayStr})`,
      });
      continue;
    }

    // 年の決定: 月の単調性で判定
    // - 期間が 2025/04 〜 2026/04 のとき:
    //   - 月 >= startMonth (例 04) なら startYear (2025)
    //   - 月 < startMonth なら endYear (2026)
    // - ただし最初の月が startMonth と一致した場合、現在の年で続行
    // - 月が prevMonth より小さくなった瞬間に endYear に切替 (年跨ぎ)
    if (prevMonth === null) {
      // 最初の行: filename 推論で開始年を決定
      currentYear = month >= period.startMonth ? period.startYear : period.endYear;
    } else if (month < prevMonth) {
      // 年跨ぎ: 月が小さくなった = 翌年に進んだ
      currentYear = period.endYear;
    }
    // 月 == prevMonth or 月 > prevMonth (時系列順) → currentYear 維持
    prevMonth = month;

    // 取引名 (出金 / 入金)
    const transactionKind = (cols[COL.TRANSACTION_KIND] ?? "").trim();
    if (transactionKind === "") {
      warnings.push({
        line_number: lineNo,
        raw_line: raw,
        reason: "取引名 (col 13) が空",
      });
      continue;
    }
    const isDeposit = transactionKind.includes("入金");
    const flow = isDeposit ? "deposit" : "withdrawal";

    // 金額
    const amountStr = (cols[COL.AMOUNT] ?? "").trim();
    if (!/^\d+$/.test(amountStr)) {
      warnings.push({
        line_number: lineNo,
        raw_line: raw,
        reason: `金額が不正 (${amountStr})`,
      });
      continue;
    }
    const amount = Number(amountStr);

    // 摘要
    const description = (cols[COL.DESCRIPTION] ?? "")
      .replace(/　/g, " ") // 全角空白 → 半角空白
      .trim();
    if (description === "") {
      warnings.push({
        line_number: lineNo,
        raw_line: raw,
        reason: "摘要が空 (Python read_api_mizuho と同じく skip)",
      });
      continue;
    }

    const transactionDate = `${currentYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    rows.push({
      transaction_date: transactionDate,
      amount,
      flow,
      description,
      balance_after: null, // みずほ .api は残高列なし
      source_line_number: lineNo,
    });
  }

  return {
    bank_kind: BANK_KIND,
    rows,
    header_line_number: headerLineNumber,
    opening_balance: null, // .api は残高無いため逆算不可 (manual_balance_20260430 を使う)
    closing_balance: null,
    opening_balance_derivation: null,
    warnings,
  };
}

/**
 * みずほ .api ファイル名から期間を推論する。
 *
 * 例: "HS000120260506095245_202504から20260430まで.api"
 *   → { startYear: 2025, startMonth: 4, endYear: 2026, endMonth: 4, endDay: 30 }
 *
 * 例: "..._202504から20260430まで.api" (リンクサポート 3 週間)
 *   → 同上 (期間自体はファイル名で同じ)
 *
 * 例: "..._20260410から20260430まで.api" (短期間)
 *   → { startYear: 2026, startMonth: 4, endYear: 2026, endMonth: 4, endDay: 30 }
 */
export function deriveMizuhoFilenamePeriod(
  filename: string,
): MizuhoFilenamePeriod | null {
  // 候補: YYYYMMDD (8 桁) を優先、次に YYYYMM (6 桁)
  // パターン: "YYYYMM(DD?)から YYYYMM(DD?) まで"
  // 順序が重要: より具体 (DD あり) を先にチェック。

  // 8 桁 + から + 8 桁
  let m = filename.match(/(\d{4})(\d{2})(\d{2})から(\d{4})(\d{2})(\d{2})/);
  if (m) {
    return {
      startYear: Number(m[1]),
      startMonth: Number(m[2]),
      endYear: Number(m[4]),
      endMonth: Number(m[5]),
      endDay: Number(m[6]),
    };
  }

  // 6 桁 + から + 8 桁 (例: "202504から20260430まで") ← ARATA / センターライズ / ヒュアラン
  // (start が DD なしのケース)
  m = filename.match(/(\d{4})(\d{2})から(\d{4})(\d{2})(\d{2})/);
  if (m) {
    return {
      startYear: Number(m[1]),
      startMonth: Number(m[2]),
      endYear: Number(m[3]),
      endMonth: Number(m[4]),
      endDay: Number(m[5]),
    };
  }

  // 8 桁 + から + 6 桁
  m = filename.match(/(\d{4})(\d{2})(\d{2})から(\d{4})(\d{2})/);
  if (m) {
    return {
      startYear: Number(m[1]),
      startMonth: Number(m[2]),
      endYear: Number(m[4]),
      endMonth: Number(m[5]),
      endDay: null,
    };
  }

  // 6 桁 + から + 6 桁 (例: "202504から202604")
  m = filename.match(/(\d{4})(\d{2})から(\d{4})(\d{2})/);
  if (m) {
    return {
      startYear: Number(m[1]),
      startMonth: Number(m[2]),
      endYear: Number(m[3]),
      endMonth: Number(m[4]),
      endDay: null,
    };
  }

  return null;
}
