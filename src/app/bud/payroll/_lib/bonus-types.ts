/**
 * Garden-Bud / Phase D #03 賞与計算 TypeScript 型定義
 *
 * 対応 spec: docs/specs/2026-04-25-bud-phase-d-03-bonus-calculation.md
 * 対応 migration: supabase/migrations/20260507000005_bud_phase_d03_bonus_calculation.sql
 *
 * Cat 4 #28 反映: 賞与処理は admin のみ INSERT/UPDATE。
 * 社保部分は D-05 calculateBonusInsurance を再利用、本ライブラリは
 * 源泉徴収（算出率表ルックアップ）+ gross/net 計算に専念。
 */

import type { KouOtsu } from "./salary-types";
import type { BonusInsuranceBreakdown } from "./insurance-types";

// ============================================================
// 列挙型
// ============================================================

export const BONUS_RECORD_STATUSES = [
  "calculated",
  "approved",
  "paid",
  "cancelled",
] as const;
export type BonusRecordStatus = (typeof BONUS_RECORD_STATUSES)[number];

// ============================================================
// 賞与算出率表
// ============================================================

export interface BonusWithholdingRateRow {
  id: string;
  effectiveYear: number;
  kouOtsu: KouOtsu;
  previousMonthMin: number;
  previousMonthMax: number | null; // null = 上限なし
  dependents0: number; // 例: 0.04084
  dependents1: number;
  dependents2: number;
  dependents3: number;
  dependents4: number;
  dependents5: number;
  dependents6: number;
  dependents7: number;
}

// ============================================================
// 賞与レコード
// ============================================================

export interface BudBonusRecord {
  id: string;
  payrollPeriodId: string;
  bonusLabel: string; // '2026年夏季賞与' 等
  bonusPaymentDate: string; // YYYY-MM-DD
  employeeId: string;

  // 支給額
  baseBonus: number;
  performanceAddition: number;
  otherAdditions: Record<string, number> | null;
  grossBonus: number;

  // 社保（D-05 結果転記）
  healthInsurance: number;
  welfarePension: number;
  longTermCareInsurance: number;
  employmentInsurance: number;
  totalSocialInsurance: number;

  // 源泉徴収
  withholdingRate: number;
  withholdingTax: number;

  // 控除合計・差引支給額
  totalDeductions: number;
  netBonus: number;

  // スナップショット
  previousMonthTaxableAmount: number;
  kouOtsuAtCalculation: KouOtsu;
  dependentsCountAtCalculation: number;
  healthCapped: boolean;
  pensionCapped: boolean;

  status: BonusRecordStatus;
  calculatedAt: string;
  calculatedBy: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  paidAt: string | null;
}

// ============================================================
// 計算入力
// ============================================================

export interface BonusGrossCalculationInput {
  /** 基本賞与（業務判断による額）*/
  baseBonus: number;
  /** 業績加算 */
  performanceAddition: number;
  /** 各種加算（label → amount）*/
  otherAdditions: Record<string, number>;
}

export interface BonusGrossResult {
  baseBonus: number;
  performanceAddition: number;
  otherAdditionsTotal: number;
  grossBonus: number;
}

export interface BonusWithholdingTaxInput {
  /** 賞与の課税対象額 = grossBonus - totalSocialInsurance（賞与社保） */
  taxableBonusAmount: number;
  /** 算出率（lookupBonusWithholdingRate の結果）*/
  withholdingRate: number;
}

export interface BonusWithholdingRateLookupInput {
  /** 前月給与の社保控除後の課税対象額 */
  previousMonthTaxableAmount: number;
  /** 甲乙区分 */
  kouOtsu: KouOtsu;
  /** 扶養親族数 */
  dependentsCount: number;
  /** 算出率表（当該年度の全行）*/
  rateTable: BonusWithholdingRateRow[];
}

export interface BonusNetCalculationInput {
  grossBonus: number;
  totalSocialInsurance: number;
  withholdingTax: number;
}

export interface BonusNetResult {
  totalDeductions: number;
  netBonus: number;
}

// ============================================================
// 統合結果（社保 + 源泉 + ネット）
// ============================================================

export interface BonusCalculationFullResult {
  gross: BonusGrossResult;
  socialInsurance: BonusInsuranceBreakdown;
  withholdingRate: number;
  withholdingTax: number;
  net: BonusNetResult;
  /** 健保上限到達 */
  healthCapped: boolean;
  /** 厚年上限到達 */
  pensionCapped: boolean;
}
