/**
 * Garden-Bud / Phase D #05 社会保険料計算（純関数）
 *
 * 対応 spec: docs/specs/2026-04-25-bud-phase-d-05-social-insurance.md §4-§7
 *
 * 純関数のみ（DB アクセスなし、Date.now() 等の副作用なし）。
 * Server Action / Cron からは DB アクセス済の入力を渡して呼ぶ想定。
 *
 * 端数処理規則（spec §4.3）:
 *   健保・厚年・介護: 1 円未満は従業員負担を切り捨て（Math.floor）、会社負担は逆に切り上げ
 *   雇用保険: 1 円未満切り捨て（Math.floor）
 *   ※ 本ライブラリは「従業員負担額」のみ算出
 */

import {
  type BudStandardRemunerationGrade,
  type SocialInsuranceBreakdown,
  type BonusInsuranceBreakdown,
  type MonthlyInsuranceCalculationInput,
  type BonusInsuranceCalculationInput,
  HEALTH_BONUS_ANNUAL_CAP,
  PENSION_BONUS_PER_PAYMENT_CAP,
  LONG_TERM_CARE_START_AGE,
  LONG_TERM_CARE_END_AGE,
} from "./insurance-types";

// ============================================================
// 基本ヘルパー
// ============================================================

/**
 * 介護保険の対象年齢か判定。40-64 歳（65 歳到達月の前月で控除終了）。
 *
 * 注: 厳密には 40 歳到達月から控除開始、65 歳到達月の前月で終了だが、
 * このライブラリは年齢ベースで判定（具体的な月境界は呼び出し側で計算基準日時点の年齢を渡す）。
 */
export function isLongTermCareTarget(age: number): boolean {
  return age >= LONG_TERM_CARE_START_AGE && age <= LONG_TERM_CARE_END_AGE;
}

/**
 * 千円未満切り捨て（標準賞与額の決定ルール）。
 * 例: 1_234_567 → 1_234_000
 */
export function floorToThousand(value: number): number {
  return Math.floor(value / 1000) * 1000;
}

/**
 * 等級表から報酬月額に対応する等級を検索。
 *
 * @param grades 当該保険種別 × 当該年度の等級テーブル全件
 * @param remuneration 報酬月額（円）
 * @returns 該当する等級レコード、見つからない場合 null（最高等級超過時）
 */
export function lookupGrade(
  grades: BudStandardRemunerationGrade[],
  remuneration: number,
): BudStandardRemunerationGrade | null {
  if (remuneration < 0) return null;

  // 報酬月額が範囲内の等級を検索
  // remuneration_max が null なら上限なし（最高等級）
  for (const g of grades) {
    if (remuneration < g.remunerationMin) continue;
    if (g.remunerationMax === null) return g; // 最高等級
    if (remuneration < g.remunerationMax) return g;
  }

  // 全件不一致 = remuneration が最高等級の min を下回る、または等級表が空
  // 最高等級が remunerationMax=null だった場合、上のループで return しているので
  // ここに到達するのは「等級表が空」「remuneration が最低等級未満」のいずれか
  return null;
}

// ============================================================
// 月次給与時の社保計算
// ============================================================

/**
 * 月次給与時の社会保険料を計算（従業員負担分、円）。
 *
 * 計算ステップ（spec §4.1）:
 *   1. 免除中なら雇用保険を除いてゼロ
 *   2. 健保 = 標準報酬月額 × 健保率 × 1/2（floor）
 *   3. 厚年 = 標準報酬月額 × 18.3% × 1/2（floor）
 *   4. 介護（40-64 歳のみ）= 標準報酬月額 × 介護率 × 1/2（floor）
 *   5. 雇用 = 月総支給額 × 雇用従業員率（floor）
 */
export function calculateMonthlyInsurance(
  input: MonthlyInsuranceCalculationInput,
): SocialInsuranceBreakdown {
  const isCare = isLongTermCareTarget(input.age);

  // 雇用保険は産休・育休でも免除されない（実支給がゼロ前提なので結果ゼロになるだけ）
  const employment = Math.floor(input.grossPay * input.rate.employmentEmployeeRate);

  if (input.exempted) {
    return {
      healthInsurance: 0,
      welfarePension: 0,
      longTermCareInsurance: 0,
      employmentInsurance: employment,
      total: employment,
      healthGrade: input.healthGrade.grade,
      pensionGrade: input.pensionGrade.grade,
      exempted: true,
    };
  }

  const health = Math.floor(
    (input.healthGrade.standardAmount * input.rate.healthRate) / 2,
  );
  const pension = Math.floor(
    (input.pensionGrade.standardAmount * input.rate.pensionRate) / 2,
  );
  const longTermCare = isCare
    ? Math.floor((input.healthGrade.standardAmount * input.rate.longTermCareRate) / 2)
    : 0;

  return {
    healthInsurance: health,
    welfarePension: pension,
    longTermCareInsurance: longTermCare,
    employmentInsurance: employment,
    total: health + pension + longTermCare + employment,
    healthGrade: input.healthGrade.grade,
    pensionGrade: input.pensionGrade.grade,
    exempted: false,
  };
}

// ============================================================
// 賞与時の社保計算（spec §7、D-03 §5 連動）
// ============================================================

/**
 * 賞与時の標準賞与額（健保用）を計算。
 *
 * 健保: 年度累計 573 万円上限。本賞与の標準賞与額は
 *   min(本賞与（千円未満切り捨て）, 上限 - 累計)
 * 例:
 *   累計 0 円 + 本賞与 600 万円 → 標準賞与額 = 573 万円（上限到達）
 *   累計 500 万円 + 本賞与 100 万円 → 標準賞与額 = 73 万円（残額分のみ）
 */
export function calculateHealthStandardBonus(
  grossBonus: number,
  yearToDateHealthBonus: number,
): { standardBonus: number; capped: boolean } {
  const remainingCap = Math.max(HEALTH_BONUS_ANNUAL_CAP - yearToDateHealthBonus, 0);
  const flooredBonus = floorToThousand(grossBonus);
  const standardBonus = Math.min(flooredBonus, remainingCap);
  return {
    standardBonus,
    capped: flooredBonus > remainingCap,
  };
}

/**
 * 賞与時の標準賞与額（厚年用）を計算。
 *
 * 厚年: 1 回 150 万円上限。
 *   標準賞与額 = min(本賞与（千円未満切り捨て）, 150 万円)
 */
export function calculatePensionStandardBonus(grossBonus: number): {
  standardBonus: number;
  capped: boolean;
} {
  const flooredBonus = floorToThousand(grossBonus);
  const standardBonus = Math.min(flooredBonus, PENSION_BONUS_PER_PAYMENT_CAP);
  return {
    standardBonus,
    capped: flooredBonus > PENSION_BONUS_PER_PAYMENT_CAP,
  };
}

/**
 * 賞与時の社会保険料を計算（従業員負担分、円）。
 *
 * spec §7:
 *   健保: 標準賞与額（年度累計上限考慮）× 健保率 × 1/2
 *   厚年: 標準賞与額（1 回上限考慮）× 18.3% × 1/2
 *   介護: 健保と同額の標準賞与額に介護率 × 1/2（40-64 歳のみ）
 *   雇用: 実支給額 × 雇用従業員率（上限なし）
 */
export function calculateBonusInsurance(
  input: BonusInsuranceCalculationInput,
): BonusInsuranceBreakdown {
  const isCare = isLongTermCareTarget(input.age);
  const employment = Math.floor(
    input.grossBonus * input.rate.employmentEmployeeRate,
  );

  if (input.exempted) {
    return {
      healthInsurance: 0,
      welfarePension: 0,
      longTermCareInsurance: 0,
      employmentInsurance: employment,
      total: employment,
      healthCapped: false,
      pensionCapped: false,
      exempted: true,
    };
  }

  const healthBonus = calculateHealthStandardBonus(
    input.grossBonus,
    input.yearToDateHealthBonus,
  );
  const pensionBonus = calculatePensionStandardBonus(input.grossBonus);

  const health = Math.floor((healthBonus.standardBonus * input.rate.healthRate) / 2);
  const pension = Math.floor(
    (pensionBonus.standardBonus * input.rate.pensionRate) / 2,
  );
  const longTermCare = isCare
    ? Math.floor((healthBonus.standardBonus * input.rate.longTermCareRate) / 2)
    : 0;

  return {
    healthInsurance: health,
    welfarePension: pension,
    longTermCareInsurance: longTermCare,
    employmentInsurance: employment,
    total: health + pension + longTermCare + employment,
    healthCapped: healthBonus.capped,
    pensionCapped: pensionBonus.capped,
    exempted: false,
  };
}

// ============================================================
// 月変判定（spec §5、純関数版）
// ============================================================

/**
 * 月変（随時改定）の判定条件:
 *   1. 固定的賃金の変動（呼び出し側で前提確認）
 *   2. 連続 3 ヶ月の平均報酬で等級が 2 以上変動
 *   3. 各月とも 17 日以上の支払基礎日数
 */

export interface GetsuhenJudgmentInput {
  /** 当月含む直近 3 ヶ月の月次給与（古い順）*/
  threeMonthsRecords: Array<{
    grossPay: number;
    paymentBaseDays: number; // 支払基礎日数
  }>;
  /** 現等級 */
  currentGrade: number;
  /** 等級表（同一保険種別・同一年度の全等級）*/
  grades: BudStandardRemunerationGrade[];
  /** 固定的賃金の変動があったか（呼び出し側判定）*/
  fixedPayChanged: boolean;
}

export interface GetsuhenJudgmentResult {
  /** 月変対象か */
  isTarget: boolean;
  /** 新等級（判定対象でない場合は null）*/
  newGrade: number | null;
  /** 等級差分（abs 値、判定対象でない場合は null）*/
  gradeDiff: number | null;
  /** 不適格理由（判定 OK の場合は null）*/
  ineligibleReason: string | null;
}

/** 支払基礎日数の最低ライン（17 日）*/
export const GETSUHEN_MIN_PAYMENT_DAYS = 17;

/** 月変の等級差分閾値（2 等級以上）*/
export const GETSUHEN_GRADE_DIFF_THRESHOLD = 2;

/**
 * 月変（随時改定）の対象判定（純関数）。
 *
 * @returns isTarget = true なら 4 ヶ月目から改定対象
 */
export function judgeGetsuhen(
  input: GetsuhenJudgmentInput,
): GetsuhenJudgmentResult {
  if (!input.fixedPayChanged) {
    return {
      isTarget: false,
      newGrade: null,
      gradeDiff: null,
      ineligibleReason: "固定的賃金の変動なし",
    };
  }

  if (input.threeMonthsRecords.length !== 3) {
    return {
      isTarget: false,
      newGrade: null,
      gradeDiff: null,
      ineligibleReason: `3 ヶ月分のレコードが必要（実際: ${input.threeMonthsRecords.length} ヶ月）`,
    };
  }

  // 全月で 17 日以上の支払基礎日数が必要
  const insufficient = input.threeMonthsRecords.some(
    (r) => r.paymentBaseDays < GETSUHEN_MIN_PAYMENT_DAYS,
  );
  if (insufficient) {
    return {
      isTarget: false,
      newGrade: null,
      gradeDiff: null,
      ineligibleReason: `支払基礎日数 ${GETSUHEN_MIN_PAYMENT_DAYS} 日未満の月あり`,
    };
  }

  // 平均報酬から新等級を決定
  const avg =
    input.threeMonthsRecords.reduce((s, r) => s + r.grossPay, 0) /
    input.threeMonthsRecords.length;
  const newGradeRecord = lookupGrade(input.grades, avg);
  if (!newGradeRecord) {
    return {
      isTarget: false,
      newGrade: null,
      gradeDiff: null,
      ineligibleReason: `平均報酬 ${avg} 円が等級表範囲外`,
    };
  }

  const gradeDiff = Math.abs(newGradeRecord.grade - input.currentGrade);
  if (gradeDiff < GETSUHEN_GRADE_DIFF_THRESHOLD) {
    return {
      isTarget: false,
      newGrade: newGradeRecord.grade,
      gradeDiff,
      ineligibleReason: `等級差 ${gradeDiff} が ${GETSUHEN_GRADE_DIFF_THRESHOLD} 等級未満`,
    };
  }

  return {
    isTarget: true,
    newGrade: newGradeRecord.grade,
    gradeDiff,
    ineligibleReason: null,
  };
}
