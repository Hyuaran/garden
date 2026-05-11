/**
 * Garden-Bud / 03_Bank: 5/11 11:48 時点の実残高（mock data、alpha 用）
 *
 * 対応 dispatch: main- No. 276 §E 5/11 11:48 残高表（東海林さん手作業集計）
 *
 * 出典: 東海林さん手作業で各銀行サイト目視 → Excel 集計 → 後道さん報告。
 * 本 mock は **alpha 版 UI 表示の正本**として埋め込み。Supabase 移行後は
 * bud_bank_balances テーブルから読み込みに切替。
 *
 * 総合計: ¥103,703,627（6 法人 × 4 銀行、5/11 11:48 JST 時点）
 */

import type { AllCorpsSummary, BankCode, CorpBankSummary, CorpCode } from "./types";
import { BANK_LABELS, CORP_LABELS } from "./types";

const BALANCE_DATE = "2026-05-11";
const SOURCE_MANUAL: "manual_input" = "manual_input";

/**
 * 5/11 11:48 時点の生残高データ。
 * - みずほ: 全 4 法人で通帳ベース手入力（CSV に残高列なし）
 * - PayPay: ヒュアラン + センターライズで手入力（システム障害で CSV 不可）
 * - 楽天: CSV 自動取込想定（alpha では手入力扱い）
 * - 京都: ヒュアランのみ、CSV 自動取込想定
 */
const RAW_DATA: Array<{
  corpCode: CorpCode;
  bankCode: BankCode;
  balance: number;
  needsManualBalance: boolean;
}> = [
  // ヒュアラン: 45,604,598 = 17,628,380 + 21,705,543 + 158,063 + 6,112,612
  { corpCode: "hyuaran", bankCode: "mizuho", balance: 17_628_380, needsManualBalance: true },
  { corpCode: "hyuaran", bankCode: "rakuten", balance: 21_705_543, needsManualBalance: false },
  { corpCode: "hyuaran", bankCode: "paypay", balance: 158_063, needsManualBalance: true },
  { corpCode: "hyuaran", bankCode: "kyoto", balance: 6_112_612, needsManualBalance: false },

  // センターライズ: 9,474,260 = 9,037,780 + 436,480
  { corpCode: "centerrise", bankCode: "mizuho", balance: 9_037_780, needsManualBalance: true },
  { corpCode: "centerrise", bankCode: "paypay", balance: 436_480, needsManualBalance: true },

  // リンクサポート: 13,544,954 = 1,226,652 + 12,318,302
  { corpCode: "linksupport", bankCode: "mizuho", balance: 1_226_652, needsManualBalance: true },
  { corpCode: "linksupport", bankCode: "rakuten", balance: 12_318_302, needsManualBalance: false },

  // ARATA: 20,129,784 = 18,334,348 + 1,795,436
  { corpCode: "arata", bankCode: "mizuho", balance: 18_334_348, needsManualBalance: true },
  { corpCode: "arata", bankCode: "rakuten", balance: 1_795_436, needsManualBalance: false },

  // たいよう: 14,116,044 = 14,116,044（楽天のみ）
  { corpCode: "taiyou", bankCode: "rakuten", balance: 14_116_044, needsManualBalance: false },

  // 壱: 833,987 = 833,987（楽天のみ）
  { corpCode: "ichi", bankCode: "rakuten", balance: 833_987, needsManualBalance: false },
];

// ============================================================
// 集計関数（純関数）
// ============================================================

/**
 * Mock data から 1 法人のサマリを生成。
 */
function buildCorpSummary(corpCode: CorpCode): CorpBankSummary {
  const banks = RAW_DATA.filter((r) => r.corpCode === corpCode).map((r) => ({
    bankCode: r.bankCode,
    bankLabel: BANK_LABELS[r.bankCode],
    balance: r.balance,
    source: SOURCE_MANUAL,
    balanceDate: BALANCE_DATE,
    needsManualBalance: r.needsManualBalance,
  }));

  const total = banks.reduce((acc, b) => acc + b.balance, 0);

  return {
    corpCode,
    corpLabel: CORP_LABELS[corpCode],
    banks,
    total,
  };
}

/**
 * 全社サマリを返す。
 */
export function getMockAllCorpsSummary(): AllCorpsSummary {
  const corpCodes: CorpCode[] = [
    "hyuaran",
    "centerrise",
    "linksupport",
    "arata",
    "taiyou",
    "ichi",
  ];
  const corpSummaries = corpCodes.map(buildCorpSummary);
  const grandTotal = corpSummaries.reduce((acc, c) => acc + c.total, 0);

  return {
    corpSummaries,
    grandTotal,
    oldestBalanceDate: BALANCE_DATE,
    latestBalanceDate: BALANCE_DATE,
  };
}

/**
 * 期待される総合計（テスト・検算用）。
 * dispatch main- No. 276 §E に記載: ¥103,703,627
 */
export const EXPECTED_GRAND_TOTAL_20260511 = 103_703_627;
