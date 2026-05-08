/**
 * D-10 給与計算統合 インセン 5 種 単体テスト
 *
 * 対応 spec: docs/specs/2026-04-26-bud-phase-d-10-payroll-calculation.md §5
 *
 * 網羅項目:
 *   1. calculateApIncentive
 *   2. calculateCaseIncentive（段階制累進）
 *   3. calculatePresidentIncentive（ランキング）
 *   4. calculateTeamVictoryBonus（達成率 threshold）
 *   5. calculatePAchievementBonus（個人達成率段階）
 *   6. calculateAllIncentives（統合）
 *   7. summarizeTeam（部署別集計）
 *   8. selectIncentiveRateTable（effective 範囲 + 法人優先）
 */

import { describe, it, expect } from "vitest";
import {
  calculateApIncentive,
  calculateCaseIncentive,
  calculatePresidentIncentive,
  calculateTeamVictoryBonus,
  calculatePAchievementBonus,
  calculateAllIncentives,
  summarizeTeam,
  selectIncentiveRateTable,
} from "../incentive-calculator";
import type {
  IncentiveCalculationContext,
  IncentiveTableData,
} from "../incentive-types";

// ============================================================
// テストフィクスチャ
// ============================================================

function buildTable(
  overrides: Partial<IncentiveTableData> = {},
): IncentiveTableData {
  return {
    ap: { rate_per_aporan: 500 },
    case: [
      { from: 0, to: 5, amount_per_case: 1000 },
      { from: 6, to: 10, amount_per_case: 1500 },
      { from: 11, to: null, amount_per_case: 2000 },
    ],
    president: { top_n: 3, rewards: [50_000, 30_000, 20_000] },
    team_victory: { achievement_threshold: 1.0, amount_per_member: 5_000 },
    p_achievement: [
      { rate_from: 1.0, rate_to: 1.2, bonus: 10_000 },
      { rate_from: 1.2, rate_to: null, bonus: 30_000 },
    ],
    ...overrides,
  };
}

function buildContext(
  overrides: Partial<IncentiveCalculationContext> = {},
): IncentiveCalculationContext {
  return {
    employee: { id: "emp-1", teamId: "team-1" },
    treeKpi: {
      employeeId: "emp-1",
      teamId: "team-1",
      payPeriod: "2026-05-01",
      aporanCount: 0,
      closeCount: 0,
      totalCases: 0,
      avgEfficiency: 0,
    },
    team: {
      targetP: 100,
      teamMembers: [{ id: "emp-1", achievedP: 100 }],
    },
    monthlyIncentiveTable: buildTable(),
    personalAchievement: { targetP: 100, achievedP: 100 },
    presidentRanking: null,
    ...overrides,
  };
}

// ============================================================
// 1. calculateApIncentive
// ============================================================

describe("calculateApIncentive", () => {
  it("アポラン 0 件 → 0", () => {
    const ctx = buildContext({
      treeKpi: { ...buildContext().treeKpi, aporanCount: 0 },
    });
    expect(calculateApIncentive(ctx)).toBe(0);
  });

  it("アポラン 10 件 × 500 = 5000", () => {
    const ctx = buildContext({
      treeKpi: { ...buildContext().treeKpi, aporanCount: 10 },
    });
    expect(calculateApIncentive(ctx)).toBe(5_000);
  });

  it("係数 0 → 0", () => {
    const ctx = buildContext({
      treeKpi: { ...buildContext().treeKpi, aporanCount: 100 },
      monthlyIncentiveTable: buildTable({ ap: { rate_per_aporan: 0 } }),
    });
    expect(calculateApIncentive(ctx)).toBe(0);
  });
});

// ============================================================
// 2. calculateCaseIncentive（累進段階）
// ============================================================

describe("calculateCaseIncentive", () => {
  it("0 件 → 0", () => {
    const ctx = buildContext();
    expect(calculateCaseIncentive(ctx)).toBe(0);
  });

  it("3 件（第 1 段階内）→ 3 × 1000 = 3000", () => {
    const ctx = buildContext({
      treeKpi: { ...buildContext().treeKpi, totalCases: 3 },
    });
    expect(calculateCaseIncentive(ctx)).toBe(3_000);
  });

  it("5 件（第 1 段階上限ちょうど）→ 5 × 1000 = 5000", () => {
    const ctx = buildContext({
      treeKpi: { ...buildContext().treeKpi, totalCases: 5 },
    });
    expect(calculateCaseIncentive(ctx)).toBe(5_000);
  });

  it("12 件（3 段階目に到達）→ 5×1000 + 5×1500 + 2×2000 = 16500（spec §5.2 例）", () => {
    const ctx = buildContext({
      treeKpi: { ...buildContext().treeKpi, totalCases: 12 },
    });
    // 第 1: 1-5 件目 = 5 件 × 1000 = 5000
    // 第 2: 6-10 件目 = 5 件 × 1500 = 7500
    // 第 3: 11-12 件目 = 2 件 × 2000 = 4000
    // 合計 16500（spec §5.2 例と一致）
    expect(calculateCaseIncentive(ctx)).toBe(16_500);
  });

  it("係数表が空 → 0", () => {
    const ctx = buildContext({
      treeKpi: { ...buildContext().treeKpi, totalCases: 100 },
      monthlyIncentiveTable: buildTable({ case: [] }),
    });
    expect(calculateCaseIncentive(ctx)).toBe(0);
  });

  it("100 件（最高段階内）", () => {
    const ctx = buildContext({
      treeKpi: { ...buildContext().treeKpi, totalCases: 100 },
    });
    // 第 1: 1-5 件目 = 5 件 × 1000 = 5000
    // 第 2: 6-10 件目 = 5 件 × 1500 = 7500
    // 第 3: 11-100 件目 = 90 件 × 2000 = 180000
    // 合計 192500
    expect(calculateCaseIncentive(ctx)).toBe(192_500);
  });
});

// ============================================================
// 3. calculatePresidentIncentive（ランキング）
// ============================================================

describe("calculatePresidentIncentive", () => {
  it("ランキング外（null）→ 0", () => {
    const ctx = buildContext({ presidentRanking: null });
    expect(calculatePresidentIncentive(ctx)).toBe(0);
  });

  it("1 位（rank=0）→ rewards[0] = 50000", () => {
    const ctx = buildContext({ presidentRanking: 0 });
    expect(calculatePresidentIncentive(ctx)).toBe(50_000);
  });

  it("2 位（rank=1）→ 30000", () => {
    const ctx = buildContext({ presidentRanking: 1 });
    expect(calculatePresidentIncentive(ctx)).toBe(30_000);
  });

  it("3 位（rank=2、top_n=3 境界）→ 20000", () => {
    const ctx = buildContext({ presidentRanking: 2 });
    expect(calculatePresidentIncentive(ctx)).toBe(20_000);
  });

  it("4 位（rank=3、top_n=3 圏外）→ 0", () => {
    const ctx = buildContext({ presidentRanking: 3 });
    expect(calculatePresidentIncentive(ctx)).toBe(0);
  });

  it("負数（不正）→ 0", () => {
    const ctx = buildContext({ presidentRanking: -1 });
    expect(calculatePresidentIncentive(ctx)).toBe(0);
  });
});

// ============================================================
// 4. calculateTeamVictoryBonus（達成率 threshold）
// ============================================================

describe("calculateTeamVictoryBonus", () => {
  it("team=null → 0", () => {
    const ctx = buildContext({ team: null });
    expect(calculateTeamVictoryBonus(ctx)).toBe(0);
  });

  it("達成率 100% ちょうど（threshold 境界）→ 5000", () => {
    const ctx = buildContext({
      team: { targetP: 100, teamMembers: [{ id: "a", achievedP: 100 }] },
    });
    expect(calculateTeamVictoryBonus(ctx)).toBe(5_000);
  });

  it("達成率 99%（未達）→ 0", () => {
    const ctx = buildContext({
      team: { targetP: 100, teamMembers: [{ id: "a", achievedP: 99 }] },
    });
    expect(calculateTeamVictoryBonus(ctx)).toBe(0);
  });

  it("複数メンバー、合計達成率 120%", () => {
    const ctx = buildContext({
      team: {
        targetP: 200,
        teamMembers: [
          { id: "a", achievedP: 130 },
          { id: "b", achievedP: 110 },
        ],
      },
    });
    expect(calculateTeamVictoryBonus(ctx)).toBe(5_000);
  });

  it("targetP=0（不正）→ 0", () => {
    const ctx = buildContext({
      team: { targetP: 0, teamMembers: [{ id: "a", achievedP: 100 }] },
    });
    expect(calculateTeamVictoryBonus(ctx)).toBe(0);
  });

  it("メンバー 0 名 → 0", () => {
    const ctx = buildContext({
      team: { targetP: 100, teamMembers: [] },
    });
    expect(calculateTeamVictoryBonus(ctx)).toBe(0);
  });
});

// ============================================================
// 5. calculatePAchievementBonus（個人達成率段階）
// ============================================================

describe("calculatePAchievementBonus", () => {
  it("達成率 1.0 ちょうど（境界、第 1 段階）→ 10000", () => {
    const ctx = buildContext({
      personalAchievement: { targetP: 100, achievedP: 100 },
    });
    expect(calculatePAchievementBonus(ctx)).toBe(10_000);
  });

  it("達成率 1.1（第 1 段階内）→ 10000", () => {
    const ctx = buildContext({
      personalAchievement: { targetP: 100, achievedP: 110 },
    });
    expect(calculatePAchievementBonus(ctx)).toBe(10_000);
  });

  it("達成率 1.2 ちょうど（第 2 段階に進む）→ 30000", () => {
    const ctx = buildContext({
      personalAchievement: { targetP: 100, achievedP: 120 },
    });
    expect(calculatePAchievementBonus(ctx)).toBe(30_000);
  });

  it("達成率 1.5（第 2 段階内、上限なし）→ 30000", () => {
    const ctx = buildContext({
      personalAchievement: { targetP: 100, achievedP: 150 },
    });
    expect(calculatePAchievementBonus(ctx)).toBe(30_000);
  });

  it("達成率 0.9（範囲外、未達）→ 0", () => {
    const ctx = buildContext({
      personalAchievement: { targetP: 100, achievedP: 90 },
    });
    expect(calculatePAchievementBonus(ctx)).toBe(0);
  });

  it("targetP=0（不正）→ 0", () => {
    const ctx = buildContext({
      personalAchievement: { targetP: 0, achievedP: 100 },
    });
    expect(calculatePAchievementBonus(ctx)).toBe(0);
  });
});

// ============================================================
// 6. calculateAllIncentives（統合）
// ============================================================

describe("calculateAllIncentives", () => {
  it("全項目フル稼働（達成チーム + 1 位 + 多件数）", () => {
    const ctx = buildContext({
      treeKpi: {
        employeeId: "emp-1",
        teamId: "team-1",
        payPeriod: "2026-05-01",
        aporanCount: 20,
        closeCount: 15,
        totalCases: 12,
        avgEfficiency: 95,
      },
      team: {
        targetP: 200,
        teamMembers: [
          { id: "emp-1", achievedP: 130 },
          { id: "emp-2", achievedP: 110 },
        ],
      },
      personalAchievement: { targetP: 100, achievedP: 130 },
      presidentRanking: 0,
    });

    const r = calculateAllIncentives(ctx);
    // AP: 20 × 500 = 10000
    // Case: 12 件 → 16500（spec §5.2 例）
    // President: rank 0 → 50000
    // Team Victory: 達成率 1.2 → 5000
    // P Achievement: 達成率 1.3 → 30000
    expect(r.apIncentive).toBe(10_000);
    expect(r.caseIncentive).toBe(16_500);
    expect(r.presidentIncentive).toBe(50_000);
    expect(r.teamVictoryBonus).toBe(5_000);
    expect(r.pAchievementBonus).toBe(30_000);
    expect(r.total).toBe(111_500);
  });

  it("ゼロケース（全インセン 0、team なし、未達）", () => {
    const ctx = buildContext({
      team: null,
      personalAchievement: { targetP: 100, achievedP: 50 },
    });
    const r = calculateAllIncentives(ctx);
    expect(r.total).toBe(0);
    expect(r.apIncentive).toBe(0);
    expect(r.caseIncentive).toBe(0);
    expect(r.presidentIncentive).toBe(0);
    expect(r.teamVictoryBonus).toBe(0);
    expect(r.pAchievementBonus).toBe(0);
  });
});

// ============================================================
// 7. summarizeTeam
// ============================================================

describe("summarizeTeam", () => {
  it("チーム集計", () => {
    const r = summarizeTeam({
      teamId: "team-1",
      teamName: "営業 1 部",
      payPeriod: "2026-05-01",
      targetP: 200,
      treeKpiList: [
        { employeeId: "a", avgEfficiency: 90 },
        { employeeId: "b", avgEfficiency: 110 },
      ],
      achievedPList: [
        { employeeId: "a", achievedP: 100 },
        { employeeId: "b", achievedP: 130 },
      ],
    });

    expect(r.targetP).toBe(200);
    expect(r.achievedP).toBe(230);
    expect(r.achievementRate).toBe(1.15);
    expect(r.memberCount).toBe(2);
    expect(r.avgEfficiency).toBe(100);
  });

  it("targetP=0 → achievementRate=0", () => {
    const r = summarizeTeam({
      teamId: "team-1",
      teamName: "T",
      payPeriod: "2026-05-01",
      targetP: 0,
      treeKpiList: [],
      achievedPList: [],
    });
    expect(r.achievementRate).toBe(0);
    expect(r.avgEfficiency).toBe(0);
  });
});

// ============================================================
// 8. selectIncentiveRateTable
// ============================================================

describe("selectIncentiveRateTable", () => {
  const tableA: IncentiveTableData = buildTable();
  const tableB: IncentiveTableData = buildTable({
    ap: { rate_per_aporan: 1000 },
  });

  it("法人別 + 期間内 → 法人優先", () => {
    const r = selectIncentiveRateTable({
      payPeriod: "2026-05-01",
      companyId: "comp-1",
      candidates: [
        {
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          companyId: null,
          tableData: tableA,
        },
        {
          effectiveFrom: "2026-04-01",
          effectiveTo: null,
          companyId: "comp-1",
          tableData: tableB,
        },
      ],
    });
    expect(r).toBe(tableB);
  });

  it("法人別なし → 全社共通", () => {
    const r = selectIncentiveRateTable({
      payPeriod: "2026-05-01",
      companyId: "comp-1",
      candidates: [
        {
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          companyId: null,
          tableData: tableA,
        },
      ],
    });
    expect(r).toBe(tableA);
  });

  it("期間外（effectiveFrom 未到達）→ null", () => {
    const r = selectIncentiveRateTable({
      payPeriod: "2026-01-01",
      companyId: null,
      candidates: [
        {
          effectiveFrom: "2026-04-01",
          effectiveTo: null,
          companyId: null,
          tableData: tableA,
        },
      ],
    });
    expect(r).toBeNull();
  });

  it("期間外（effectiveTo 超過）→ null", () => {
    const r = selectIncentiveRateTable({
      payPeriod: "2027-01-01",
      companyId: null,
      candidates: [
        {
          effectiveFrom: "2026-04-01",
          effectiveTo: "2026-12-31",
          companyId: null,
          tableData: tableA,
        },
      ],
    });
    expect(r).toBeNull();
  });

  it("候補ゼロ → null", () => {
    const r = selectIncentiveRateTable({
      payPeriod: "2026-05-01",
      companyId: null,
      candidates: [],
    });
    expect(r).toBeNull();
  });
});
