/**
 * Garden-Bud / Phase D #10 給与計算統合 インセン計算（純関数）
 *
 * 対応 spec: docs/specs/2026-04-26-bud-phase-d-10-payroll-calculation.md §5
 *
 * 純関数のみ。Server Action / Cron からは Tree 源泉 + 係数表 + 個人/チーム情報 を渡して呼ぶ。
 *
 * 5 種インセン:
 *   1. AP インセン         = アポラン件数 × 単価（係数表 ap.rate_per_aporan）
 *   2. 件数インセン        = 段階別単価 × 件数（係数表 case[]、from-to レンジ）
 *   3. 社長賞インセン      = 事業所別ランキング上位 N 名の固定額（係数表 president.rewards[順位]）
 *   4. チーム勝利金        = チーム達成率 ≥ threshold で全員に均等配分（係数表 team_victory）
 *   5. P 達成金            = 個人達成率の段階制（係数表 p_achievement[]、rate_from-to レンジ）
 *
 * 全ての計算結果は Math.floor で円整数。
 */

import {
  type IncentiveCalculationContext,
  type IncentiveBreakdown,
  type IncentiveTableData,
  type TreeKpiSource,
  type TeamSummary,
} from "./incentive-types";

// ============================================================
// 1. AP インセン
// ============================================================

/**
 * AP インセン = アポラン件数 × 単価
 */
export function calculateApIncentive(
  ctx: IncentiveCalculationContext,
): number {
  const rate = ctx.monthlyIncentiveTable.ap.rate_per_aporan;
  if (rate <= 0) return 0;
  return Math.floor(ctx.treeKpi.aporanCount * rate);
}

// ============================================================
// 2. 件数インセン（段階制）
// ============================================================

/**
 * 件数インセン = 段階別単価累積。
 *
 * 例: case[] = [
 *   { from: 0, to: 5, amount_per_case: 1000 },     // 1-5 件目は 1000 円/件（5 件 × 1000）
 *   { from: 6, to: 10, amount_per_case: 1500 },    // 6-10 件目は 1500 円/件（5 件 × 1500）
 *   { from: 11, to: null, amount_per_case: 2000 }  // 11 件目以降は 2000 円/件
 * ]
 *
 * 件数 12 件 → 5×1000 + 5×1500 + 2×2000 = 16500 円
 *
 * 累進セマンティクス: 各 tier は「(前段階の to + 1) 〜 当段階の to」をカバー。
 * 連続的にカバーされる前提（tier.from は表現上の値、計算は previousMax で追跡）。
 */
export function calculateCaseIncentive(
  ctx: IncentiveCalculationContext,
): number {
  const totalCases = ctx.treeKpi.totalCases;
  if (totalCases <= 0) return 0;

  const tiers = ctx.monthlyIncentiveTable.case;
  if (tiers.length === 0) return 0;

  let total = 0;
  let previousMax = 0; // 前 tier の to（最初は 0、つまり 1 件目から開始）
  for (const tier of tiers) {
    if (totalCases <= previousMax) break;

    const tierStart = previousMax + 1;
    const tierEnd = tier.to === null ? totalCases : Math.min(tier.to, totalCases);
    if (tierStart > tierEnd) {
      previousMax = tier.to ?? totalCases;
      continue;
    }

    const tierCases = tierEnd - tierStart + 1;
    total += tierCases * tier.amount_per_case;

    previousMax = tier.to ?? totalCases;
    if (tier.to === null) break; // 上限なし tier に到達 → 終了
  }
  return Math.floor(total);
}

// ============================================================
// 3. 社長賞インセン（事業所別ランキング）
// ============================================================

/**
 * 社長賞インセン = ランキング順位に応じた固定額。
 *
 * @returns presidentRanking が null（対象外）or top_n 圏外なら 0
 */
export function calculatePresidentIncentive(
  ctx: IncentiveCalculationContext,
): number {
  if (ctx.presidentRanking === null) return 0;
  const { top_n, rewards } = ctx.monthlyIncentiveTable.president;
  if (ctx.presidentRanking < 0 || ctx.presidentRanking >= top_n) return 0;
  if (ctx.presidentRanking >= rewards.length) return 0;
  return Math.floor(rewards[ctx.presidentRanking]);
}

// ============================================================
// 4. チーム勝利金（達成率 ≥ threshold で均等配分）
// ============================================================

/**
 * チーム勝利金 = チーム達成率が threshold 以上で全員に均等配分。
 *
 * チーム達成率 = チームメンバー achievedP 合計 / チーム targetP
 * threshold = 1.0 → 100% 達成で発動
 *
 * @returns team が null or 達成率不足なら 0
 */
export function calculateTeamVictoryBonus(
  ctx: IncentiveCalculationContext,
): number {
  if (ctx.team === null) return 0;
  const { targetP, teamMembers } = ctx.team;
  if (targetP <= 0) return 0;
  if (teamMembers.length === 0) return 0;

  const totalAchieved = teamMembers.reduce((s, m) => s + m.achievedP, 0);
  const achievementRate = totalAchieved / targetP;

  const { achievement_threshold, amount_per_member } =
    ctx.monthlyIncentiveTable.team_victory;
  if (achievementRate < achievement_threshold) return 0;

  return Math.floor(amount_per_member);
}

// ============================================================
// 5. P 達成金（個人達成率の段階制）
// ============================================================

/**
 * P 達成金 = 個人達成率（achievedP / targetP）に応じた段階別ボーナス。
 *
 * 例: p_achievement[] = [
 *   { rate_from: 1.0, rate_to: 1.2, bonus: 10000 },   // 100-120% 達成
 *   { rate_from: 1.2, rate_to: null, bonus: 30000 }   // 120% 以上
 * ]
 *
 * 達成率 1.5（150%）→ rate_to=null 段階の 30000 円
 * 達成率 1.1（110%）→ 第 1 段階の 10000 円
 * 達成率 0.9（90%）→ 0（範囲外、対象外）
 */
export function calculatePAchievementBonus(
  ctx: IncentiveCalculationContext,
): number {
  const { targetP, achievedP } = ctx.personalAchievement;
  if (targetP <= 0) return 0;

  const rate = achievedP / targetP;
  if (rate <= 0) return 0;

  const tiers = ctx.monthlyIncentiveTable.p_achievement;
  for (const tier of tiers) {
    const inUpper = tier.rate_to === null || rate < tier.rate_to;
    if (rate >= tier.rate_from && inUpper) {
      return Math.floor(tier.bonus);
    }
  }
  return 0;
}

// ============================================================
// 6. 統合: 5 種インセン総合計算
// ============================================================

export function calculateAllIncentives(
  ctx: IncentiveCalculationContext,
): IncentiveBreakdown {
  const apIncentive = calculateApIncentive(ctx);
  const caseIncentive = calculateCaseIncentive(ctx);
  const presidentIncentive = calculatePresidentIncentive(ctx);
  const teamVictoryBonus = calculateTeamVictoryBonus(ctx);
  const pAchievementBonus = calculatePAchievementBonus(ctx);

  return {
    apIncentive,
    caseIncentive,
    presidentIncentive,
    teamVictoryBonus,
    pAchievementBonus,
    total:
      apIncentive +
      caseIncentive +
      presidentIncentive +
      teamVictoryBonus +
      pAchievementBonus,
  };
}

// ============================================================
// 7. 部署別集計（spec §5.3）
// ============================================================

export interface TeamSummaryInput {
  teamId: string;
  teamName: string;
  payPeriod: string;
  targetP: number;
  treeKpiList: Pick<TreeKpiSource, "employeeId" | "avgEfficiency">[];
  achievedPList: Array<{ employeeId: string; achievedP: number }>;
}

/**
 * 部署別集計（チーム達成率 + 平均効率）。
 */
export function summarizeTeam(input: TeamSummaryInput): TeamSummary {
  const totalAchievedP = input.achievedPList.reduce((s, a) => s + a.achievedP, 0);
  const memberCount = input.achievedPList.length;
  const avgEfficiency =
    input.treeKpiList.length > 0
      ? input.treeKpiList.reduce((s, k) => s + k.avgEfficiency, 0) / input.treeKpiList.length
      : 0;
  const achievementRate = input.targetP > 0 ? totalAchievedP / input.targetP : 0;

  return {
    teamId: input.teamId,
    teamName: input.teamName,
    payPeriod: input.payPeriod,
    targetP: input.targetP,
    achievedP: totalAchievedP,
    achievementRate,
    memberCount,
    avgEfficiency,
  };
}

// ============================================================
// 8. 係数表選択（effective_from / to + company_id）
// ============================================================

export interface RateTableSelectionInput {
  payPeriod: string; // YYYY-MM-01
  companyId: string | null;
  candidates: Array<{
    effectiveFrom: string;
    effectiveTo: string | null;
    companyId: string | null;
    tableData: IncentiveTableData;
  }>;
}

/**
 * 適用すべきインセン係数表を選択。
 *   - effective_from <= payPeriod < effective_to (or null)
 *   - 法人別優先、なければ全社共通
 */
export function selectIncentiveRateTable(
  input: RateTableSelectionInput,
): IncentiveTableData | null {
  const target = input.payPeriod;

  // フィルタ: effective 範囲内
  const inRange = input.candidates.filter((c) => {
    if (c.effectiveFrom > target) return false;
    if (c.effectiveTo !== null && c.effectiveTo <= target) return false;
    return true;
  });

  if (inRange.length === 0) return null;

  // 法人別優先
  const companySpecific = inRange.find((c) => c.companyId === input.companyId && input.companyId !== null);
  if (companySpecific) return companySpecific.tableData;

  // 全社共通（companyId=null）
  const global = inRange.find((c) => c.companyId === null);
  if (global) return global.tableData;

  return null;
}
