/**
 * 仕訳帳機能 共通型定義
 *
 * spec: docs/superpowers/specs/2026-04-26-shiwakechou-bud-migration-design.md
 * 配置原則: src/app/forest/_lib への依存禁止 (Bud 移行時の機械的移植のため)。
 */

/** 銀行種別 (parser 切替用) */
export type BankKind = "rakuten" | "mizuho" | "paypay" | "kyoto";

/** 法人 ID (bud_corporations.id) */
export type CorpId =
  | "hyuaran"
  | "centerrise"
  | "linksupport"
  | "arata"
  | "taiyou"
  | "ichi";

/** 取引フロー */
export type TransactionFlow = "withdrawal" | "deposit";

/** 取引ステータス (bud_transactions.status) */
export type TransactionStatus =
  | "pending" // B-min 仕訳化対象 (2026/04/01-04/30)
  | "ok" // 弥生 import 済 (2025/04-2026/03)
  | "excluded" // B-min 対象外
  | "intercompany" // 法人間取引 (Phase 2)
  | "internal_transfer"; // 自社内移し替え (Phase 2)

/** ソース種別 */
export type SourceKind = "bk" | "mf" | "cc" | "cash";

/** 銀行 CSV / API パース結果の 1 行 */
export interface ParsedBankRow {
  /** 取引日 (YYYY-MM-DD) */
  transaction_date: string;
  /** 金額 (円, 符号なし) */
  amount: number;
  /** フロー */
  flow: TransactionFlow;
  /** 摘要 (原文) */
  description: string;
  /** 取引後残高 (CSV から取得できる場合のみ) */
  balance_after: number | null;
  /** 元の行番号 (1-based, デバッグ用) */
  source_line_number: number;
}

/** パース結果のメタ情報 */
export interface ParseResult {
  bank_kind: BankKind;
  rows: ParsedBankRow[];
  /** ヘッダー行の検出位置 (debug 用) */
  header_line_number: number;
  /** 期初残高 (期間最初の取引前) */
  opening_balance: number | null;
  /** 期末残高 (期間最後の取引後) */
  closing_balance: number | null;
  /** 期初残高の逆算: 1 行目残高 - 1 行目入出金額 */
  opening_balance_derivation: "csv_first_row_back_calculation" | null;
  /** parser 警告 (skip した行など) */
  warnings: ParseWarning[];
}

/** parser 警告 */
export interface ParseWarning {
  line_number: number;
  raw_line: string;
  reason: string;
}

/** parser エラー (致命的, throw する) */
export class BankParserError extends Error {
  constructor(
    message: string,
    public readonly line_number: number | null,
    public readonly raw_line: string | null,
  ) {
    super(message);
    this.name = "BankParserError";
  }
}
