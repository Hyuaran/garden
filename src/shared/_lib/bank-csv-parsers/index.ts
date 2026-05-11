/**
 * 銀行 CSV パーサー shared lib
 *
 * Garden 共通の銀行 CSV / .api / 弥生 CSV パース + エクスポート機能。
 * Forest (B-min 仕訳帳) で初期実装 → shared 化、Bud (D-3) から import 利用。
 *
 * 対応 dispatch: main- No. 283 (a-main-022, 2026-05-11)
 *
 * 元実装:
 *   - 楽天 / みずほ / PayPay / 京都 4 銀行 CSV パーサー (commit 105e322)
 *   - 弥生インポート CSV パーサー (commit 105e322)
 *   - 弥生 CSV エクスポーター (shared 化と同時に新規追加)
 *   - csv-utils (RFC 4180 ダブルクォート + 3 桁カンマ + 漢字日付)
 *
 * Bud / Forest からの使用例:
 *   import { parseRakutenCsv, exportYayoiCsv } from "@/shared/_lib/bank-csv-parsers";
 */

// ----------------------------------------------------------------
// 共通型
// ----------------------------------------------------------------
export type {
  BankKind,
  CorpId,
  TransactionFlow,
  TransactionStatus,
  SourceKind,
  ParsedBankRow,
  ParseResult,
  ParseWarning,
  YayoiImportRow,
  YayoiParseResult,
} from "./types";

export { BankParserError } from "./types";

// ----------------------------------------------------------------
// 銀行 CSV / .api パーサー
// ----------------------------------------------------------------
export {
  parseRakutenCsv,
  parseRakutenDate,
  parseSignedInt,
  splitFirstN,
  type RakutenParseOptions,
} from "./rakuten-parser";

export {
  parseMizuhoApi,
  deriveMizuhoFilenamePeriod,
  type MizuhoFilenamePeriod,
  type MizuhoParseOptions,
} from "./mizuho-parser";

export {
  parsePayPayCsv,
  type PayPayParseOptions,
} from "./paypay-parser";

export {
  parseKyotoCsv,
  type KyotoParseOptions,
} from "./kyoto-parser";

// ----------------------------------------------------------------
// 弥生 CSV import / export
// ----------------------------------------------------------------
export {
  parseYayoiImportCsv,
  parseYayoiDate,
  parseNonNegativeInt,
  type YayoiImportParseOptions,
} from "./yayoi-import-parser";

export {
  exportYayoiCsv,
  formatYayoiDate,
  sanitizeDescription,
  type YayoiExportRow,
  type YayoiExportOptions,
} from "./yayoi-csv-exporter";

// ----------------------------------------------------------------
// 共通 CSV ユーティリティ
// ----------------------------------------------------------------
export {
  parseCsvRfc4180,
  parseGroupedNumber,
  parseKanjiDate,
} from "./csv-utils";
