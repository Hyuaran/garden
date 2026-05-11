/**
 * Garden-Bud / Phase D #03 賞与計算（純関数）
 *
 * 対応 spec: docs/specs/2026-04-25-bud-phase-d-03-bonus-calculation.md
 *
 * Cat 4 #28 反映: 賞与処理は admin のみ INSERT/UPDATE。RLS は migration で対応。
 * 本ライブラリは純関数のみ。
 *
 * 役割分担:
 *   - 社保計算: D-05 calculateBonusInsurance を再利用
 *   - 算出率ルックアップ: 本ライブラリ
 *   - gross / withholding tax / net: 本ライブラリ
 *   - 統合: 本ライブラリ calculateBonusFull
 */

import {
  type BonusGrossCalculationInput,
  type BonusGrossResult,
  type BonusWithholdingTaxInput,
  type BonusWithholdingRateLookupInput,
  type BonusNetCalculationInput,
  type BonusNetResult,
  type BonusCalculationFullResult,
  type BonusWithholdingRateRow,
} from "./bonus-types";
import {
  calculateBonusInsurance,
} from "./insurance-calculator";
import type {
  BonusInsuranceCalculationInput,
  BonusInsuranceBreakdown,
} from "./insurance-types";

// ============================================================
// 1. 賞与総支給額（gross_bonus）計算
// ============================================================

export function calculateBonusGross(input: BonusGrossCalculationInput): BonusGrossResult {
  const otherAdditionsTotal = Object.values(input.otherAdditions).reduce(
    (sum, v) => sum + v,
    0,
  );
  const grossBonus = input.baseBonus + input.performanceAddition + otherAdditionsTotal;
  return {
    baseBonus: input.baseBonus,
    performanceAddition: input.performanceAddition,
    otherAdditionsTotal,
    grossBonus,
  };
}

// ============================================================
// 2. 賞与算出率のルックアップ
// ============================================================

/**
 * 賞与算出率表から「前月給与の社保控除後額 + 甲乙 + 扶養人数」に応じた率を引く。
 *
 * - 前月給与額が previous_month_min ≤ x < previous_month_max（または min ≤ x で max=null）の行を検索
 * - 甲乙別に検索（otsu の場合は dependents 関係なし、列値は乙欄共通の率）
 * - 扶養 0-7 人は表値、7 人超は dependents_7 を流用
 *
 * @returns 算出率（例: 0.04084）、表に該当行なし or 不正値で null
 */
export function lookupBonusWithholdingRate(
  input: BonusWithholdingRateLookupInput,
): number | null {
  if (input.previousMonthTaxableAmount < 0) return null;
  if (input.dependentsCount < 0) return null;

  // 甲乙でフィルタ
  const filtered = input.rateTable.filter((r) => r.kouOtsu === input.kouOtsu);

  // 範囲検索
  const row = filtered.find((r) => {
    if (input.previousMonthTaxableAmount < r.previousMonthMin) return false;
    if (r.previousMonthMax === null) return true;
    return input.previousMonthTaxableAmount < r.previousMonthMax;
  });

  if (!row) return null;

  // 扶養 0-7 人 / 7 人超は dependents_7 流用
  const lookupIndex = Math.min(input.dependentsCount, 7);
  const key = `dependents${lookupIndex}` as
    | "dependents0"
    | "dependents1"
    | "dependents2"
    | "dependents3"
    | "dependents4"
    | "dependents5"
    | "dependents6"
    | "dependents7";
  return row[key];
}

// ============================================================
// 3. 賞与の源泉徴収税額計算
// ============================================================

/**
 * 賞与の源泉徴収税額。
 * 税額 = 課税対象額 × 算出率（floor）
 *
 * 課税対象額 = grossBonus - totalSocialInsurance（呼び出し側で算出）
 */
export function calculateBonusWithholdingTax(
  input: BonusWithholdingTaxInput,
): number {
  if (input.taxableBonusAmount <= 0) return 0;
  if (input.withholdingRate <= 0) return 0;
  return Math.floor(input.taxableBonusAmount * input.withholdingRate);
}

// ============================================================
// 4. 賞与の純支給額計算
// ============================================================

export function calculateBonusNet(input: BonusNetCalculationInput): BonusNetResult {
  const totalDeductions = input.totalSocialInsurance + input.withholdingTax;
  return {
    totalDeductions,
    netBonus: input.grossBonus - totalDeductions,
  };
}

// ============================================================
// 5. 統合: 賞与計算フル
// ============================================================

export interface BonusFullCalculationInput {
  /** 賞与額入力 */
  gross: BonusGrossCalculationInput;
  /** 社保計算入力（grossBonus は本関数内で gross 計算結果を上書き設定）*/
  insurance: Omit<BonusInsuranceCalculationInput, "grossBonus">;
  /** 算出率ルックアップ入力（社保等で確定する課税対象額計算後の値ではなく、前月給与基準）*/
  rateLookup: Omit<BonusWithholdingRateLookupInput, "rateTable"> & {
    rateTable: BonusWithholdingRateRow[];
  };
}

/**
 * 賞与計算の統合関数。1 employee 1 賞与の全控除・支給を算出。
 *
 * 計算順:
 *   1. gross（base + performance + additions 合計）
 *   2. 社保（D-05 calculateBonusInsurance、上限到達フラグ含む）
 *   3. 課税対象額（gross - 社保合計）
 *   4. 算出率ルックアップ（前月給与基準、甲乙 + 扶養）
 *   5. 源泉徴収税額（課税対象額 × 算出率）
 *   6. 純支給額（gross - 社保 - 源泉）
 *
 * 算出率が見つからない場合（範囲外）は withholdingRate=0 / withholdingTax=0 で返す
 * （呼び出し側で warning として記録、再計算 trigger）。
 */
export function calculateBonusFull(
  input: BonusFullCalculationInput,
): BonusCalculationFullResult {
  // 1. gross
  const gross = calculateBonusGross(input.gross);

  // 2. 社保（D-05 calculateBonusInsurance 再利用）
  const socialInsurance: BonusInsuranceBreakdown = calculateBonusInsurance({
    ...input.insurance,
    grossBonus: gross.grossBonus,
  });

  // 3. 課税対象額
  const taxableBonusAmount = Math.max(gross.grossBonus - socialInsurance.total, 0);

  // 4. 算出率ルックアップ
  const lookupResult = lookupBonusWithholdingRate(input.rateLookup);
  const withholdingRate = lookupResult ?? 0;

  // 5. 源泉徴収税額
  const withholdingTax = calculateBonusWithholdingTax({
    taxableBonusAmount,
    withholdingRate,
  });

  // 6. 純支給額
  const net = calculateBonusNet({
    grossBonus: gross.grossBonus,
    totalSocialInsurance: socialInsurance.total,
    withholdingTax,
  });

  return {
    gross,
    socialInsurance,
    withholdingRate,
    withholdingTax,
    net,
    healthCapped: socialInsurance.healthCapped,
    pensionCapped: socialInsurance.pensionCapped,
  };
}
