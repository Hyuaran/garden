/**
 * D-08 テスト戦略 / 給与体系 fixture 骨格
 *
 * 対応 spec: docs/specs/2026-04-25-bud-phase-d-08-test-strategy.md §2.2
 *
 * Phase D-02 給与計算 / D-03 賞与計算で使用する給与体系の代表ケース。
 */

export interface SalarySystemFixture {
  id: string;
  name: string;
  /** 'monthly' | 'hourly' | 'daily' | 'commission' */
  baseCalculationMethod: "monthly" | "hourly" | "daily" | "commission";
  /** 月所定労働時間（分）、月給制で使用 */
  monthlyScheduledMinutes: number;
  /** 時間外割増（spec: 1.25 / 1.50）*/
  overtimeMultiplier: number;
  /** 60h 超時間外割増（spec: 1.50）*/
  overtimeOver60Multiplier: number;
  /** 深夜割増（spec: 1.25）*/
  lateNightMultiplier: number;
  /** 法定休日割増（spec: 1.35）*/
  holidayMultiplier: number;
}

export const standardSalarySystem: SalarySystemFixture = {
  id: "fix-ss-standard",
  name: "標準月給制（正社員）",
  baseCalculationMethod: "monthly",
  monthlyScheduledMinutes: 160 * 60, // 160h = 9600 min
  overtimeMultiplier: 1.25,
  overtimeOver60Multiplier: 1.5,
  lateNightMultiplier: 1.25,
  holidayMultiplier: 1.35,
};

export const hourlySalarySystem: SalarySystemFixture = {
  id: "fix-ss-hourly",
  name: "時給制（アルバイト）",
  baseCalculationMethod: "hourly",
  monthlyScheduledMinutes: 0,
  overtimeMultiplier: 1.25,
  overtimeOver60Multiplier: 1.5,
  lateNightMultiplier: 1.25,
  holidayMultiplier: 1.35,
};

export const commissionSalarySystem: SalarySystemFixture = {
  id: "fix-ss-comm",
  name: "歩合制（営業）",
  baseCalculationMethod: "commission",
  monthlyScheduledMinutes: 160 * 60,
  overtimeMultiplier: 1.25,
  overtimeOver60Multiplier: 1.5,
  lateNightMultiplier: 1.25,
  holidayMultiplier: 1.35,
};

export const allSalarySystems: SalarySystemFixture[] = [
  standardSalarySystem,
  hourlySalarySystem,
  commissionSalarySystem,
];
