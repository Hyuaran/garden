/**
 * Garden-Bud / Phase D #05 社会保険計算 TypeScript 型定義
 *
 * 対応 spec: docs/specs/2026-04-25-bud-phase-d-05-social-insurance.md
 * 対応 migration: supabase/migrations/20260507000003_bud_phase_d05_social_insurance.sql
 */

// ============================================================
// 列挙型
// ============================================================

export const INSURANCE_TYPES = ["health", "pension"] as const;
export type InsuranceType = (typeof INSURANCE_TYPES)[number];

export const INDUSTRY_CLASSES = [
  "general", // 一般事業
  "agriculture_forestry_fishery", // 農林水産業
  "construction", // 建設業
] as const;
export type IndustryClass = (typeof INDUSTRY_CLASSES)[number];

export const REMUNERATION_REASONS = [
  "initial", // 入社時
  "kettei", // 算定基礎届
  "getsu_hen", // 月変
  "sanzen_hen", // 産前産後・育休復帰時
  "manual", // 手動
] as const;
export type RemunerationReason = (typeof REMUNERATION_REASONS)[number];

export const EXEMPTION_TYPES = [
  "maternity", // 産前 6 週 + 産後 8 週
  "childcare", // 育休（最長 子 2 歳まで）
] as const;
export type ExemptionType = (typeof EXEMPTION_TYPES)[number];

// ============================================================
// 等級表
// ============================================================

export interface BudStandardRemunerationGrade {
  id: string;
  insuranceType: InsuranceType;
  effectiveYear: number;
  grade: number; // 1..50
  remunerationMin: number; // 報酬月額の下限
  remunerationMax: number | null; // 上限、null = 無制限（最高等級）
  standardAmount: number; // 標準報酬月額
}

// ============================================================
// 料率
// ============================================================

export interface BudInsuranceRate {
  id: string;
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo: string | null;
  prefecture: string | null; // null = 全国（厚年・雇用用）
  industryClass: IndustryClass;
  healthRate: number; // 例: 0.0998（労使合計）
  longTermCareRate: number; // 例: 0.0160（労使合計、40-64 歳のみ加算）
  pensionRate: number; // 0.183 一律
  employmentTotalRate: number; // 雇用保険 労使合計
  employmentEmployeeRate: number; // 雇用保険 従業員負担分
  notes: string | null;
}

// ============================================================
// 従業員別 標準報酬履歴
// ============================================================

export interface BudEmployeeRemunerationHistory {
  id: string;
  employeeId: string;
  insuranceType: InsuranceType;
  effectiveFrom: string; // YYYY-MM-DD（適用開始月の 1 日）
  effectiveTo: string | null;
  grade: number;
  standardAmount: number;
  reason: RemunerationReason;
  sourcePeriodId: string | null; // 月変判定根拠の period
  notes: string | null;
  createdAt: string;
  createdBy: string | null;
}

// ============================================================
// 免除（産休・育休）
// ============================================================

export interface BudEmployeeInsuranceExemption {
  id: string;
  employeeId: string;
  exemptionType: ExemptionType;
  startDate: string; // YYYY-MM-DD
  endDate: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  notes: string | null;
  createdAt: string;
}

// ============================================================
// 計算結果
// ============================================================

export interface SocialInsuranceBreakdown {
  /** 健康保険料（従業員負担、円） */
  healthInsurance: number;
  /** 厚生年金保険料（従業員負担、円） */
  welfarePension: number;
  /** 介護保険料（従業員負担、40-64 歳のみ非ゼロ、円） */
  longTermCareInsurance: number;
  /** 雇用保険料（従業員負担、円） */
  employmentInsurance: number;
  /** 総額（円） */
  total: number;
  /** 健康保険 等級（1..50）*/
  healthGrade: number;
  /** 厚生年金 等級（1..32）*/
  pensionGrade: number;
  /** 免除中なら true（このとき各値は雇用保険を除き 0）*/
  exempted: boolean;
}

// ============================================================
// 賞与時の計算結果
// ============================================================

export interface BonusInsuranceBreakdown {
  healthInsurance: number;
  welfarePension: number;
  longTermCareInsurance: number;
  employmentInsurance: number;
  total: number;
  /** 健保: 年度累計 573 万円上限到達 */
  healthCapped: boolean;
  /** 厚年: 1 回 150 万円上限到達 */
  pensionCapped: boolean;
  exempted: boolean;
}

// ============================================================
// 計算入力
// ============================================================

export interface MonthlyInsuranceCalculationInput {
  /** 健康保険等級レコード（標準報酬月額を含む）*/
  healthGrade: BudStandardRemunerationGrade;
  /** 厚生年金等級レコード */
  pensionGrade: BudStandardRemunerationGrade;
  /** 適用料率 */
  rate: BudInsuranceRate;
  /** 計算基準日時点の年齢 */
  age: number;
  /** 月の総支給額（雇用保険の基礎、円）*/
  grossPay: number;
  /** 免除中フラグ */
  exempted: boolean;
}

export interface BonusInsuranceCalculationInput {
  /** 健康保険等級レコード（実際は標準賞与額から取得、grade も保持）*/
  healthGrade: BudStandardRemunerationGrade;
  /** 厚生年金等級レコード */
  pensionGrade: BudStandardRemunerationGrade;
  /** 適用料率 */
  rate: BudInsuranceRate;
  /** 計算基準日時点の年齢 */
  age: number;
  /** 賞与総支給額（円）*/
  grossBonus: number;
  /** 当年度の累計健保標準賞与額（本賞与を除く、上限 573 万円判定用）*/
  yearToDateHealthBonus: number;
  /** 免除中フラグ */
  exempted: boolean;
}

// ============================================================
// 上限定数
// ============================================================

/** 健保 標準賞与額 年度累計上限（573 万円）*/
export const HEALTH_BONUS_ANNUAL_CAP = 5_730_000;

/** 厚年 標準賞与額 1 回上限（150 万円）*/
export const PENSION_BONUS_PER_PAYMENT_CAP = 1_500_000;

/** 介護保険 加算開始年齢（40 歳）*/
export const LONG_TERM_CARE_START_AGE = 40;

/** 介護保険 加算終了年齢（65 歳到達月の前月で控除終了、つまり 64 歳まで加算）*/
export const LONG_TERM_CARE_END_AGE = 64;
