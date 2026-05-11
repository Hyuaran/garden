/**
 * Garden-Bud / Phase D #10 給与計算統合 TypeScript 型定義
 *
 * 対応 spec: docs/specs/2026-04-26-bud-phase-d-10-payroll-calculation.md
 * 対応 migration: supabase/migrations/20260508000002_bud_phase_d10_payroll_integration.sql
 *
 * 4 次 follow-up Cat 4 #26 反映: 7 段階 status + 5 ロール体制。
 */

// ============================================================
// 列挙型
// ============================================================

export const PAYROLL_RECORD_STATUSES = [
  "draft",
  "calculated",
  "approved",
  "exported",
  "confirmed_by_auditor",
  "visual_double_checked", // 4 次 follow-up Cat 4 #26
  "confirmed_by_sharoshi",
  "finalized",
] as const;
export type PayrollRecordStatus = (typeof PAYROLL_RECORD_STATUSES)[number];

export const PAYROLL_HISTORY_ACTIONS = [
  "calculated",
  "recalculated",
  "approved",
  "rejected",
  "exported",
  "confirmed_by_auditor",
  "visual_double_check_requested",
  "visual_double_checked",
  "visual_double_check_rejected",
  "sharoshi_requested",
  "confirmed_by_sharoshi",
  "finalized",
  "rolled_back_to_draft",
] as const;
export type PayrollHistoryAction = (typeof PAYROLL_HISTORY_ACTIONS)[number];

// ============================================================
// Tree 源泉データ（read-only API 契約、a-tree との合意）
// ============================================================

export interface TreeKpiSource {
  employeeId: string;
  teamId: string | null;
  payPeriod: string; // YYYY-MM-01
  aporanCount: number; // アポラン件数（社長賞インセンの根拠）
  closeCount: number;
  totalCases: number; // 件数インセンの根拠
  avgEfficiency: number; // 部署別効率の根拠
}

// ============================================================
// インセン係数表（jsonb 構造）
// ============================================================

export interface IncentiveTableData {
  ap: { rate_per_aporan: number };
  case: Array<{
    from: number;
    to: number | null;
    amount_per_case: number;
  }>;
  president: {
    top_n: number;
    rewards: number[]; // インデックス = 順位（0 base）
  };
  team_victory: {
    achievement_threshold: number; // 例: 1.0 = 100%
    amount_per_member: number;
  };
  p_achievement: Array<{
    rate_from: number;
    rate_to: number | null;
    bonus: number;
  }>;
}

export interface BudIncentiveRateTable {
  id: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  companyId: string | null; // null = 全社共通
  tableData: IncentiveTableData;
  notes: string | null;
}

// ============================================================
// インセン計算 context
// ============================================================

export interface IncentiveCalculationContext {
  /** 対象従業員 */
  employee: {
    id: string;
    teamId: string | null;
  };
  /** Tree 源泉データ（D-10 §4 read-only API 契約）*/
  treeKpi: TreeKpiSource;
  /** チーム情報（チーム勝利金計算用）*/
  team: {
    targetP: number;
    teamMembers: Array<{ id: string; achievedP: number }>;
  } | null;
  /** 月次インセン係数表（法人別 / 期別）*/
  monthlyIncentiveTable: IncentiveTableData;
  /** 個人達成 P（P 達成金算定用）*/
  personalAchievement: {
    targetP: number;
    achievedP: number;
  };
  /** 社長賞ランキング（事業所別、本人の順位 0 base、対象外なら null）*/
  presidentRanking: number | null;
}

// ============================================================
// インセン計算結果
// ============================================================

export interface IncentiveBreakdown {
  apIncentive: number;
  caseIncentive: number;
  presidentIncentive: number;
  teamVictoryBonus: number;
  pAchievementBonus: number;
  total: number;
}

// ============================================================
// 部署別集計
// ============================================================

export interface TeamSummary {
  teamId: string;
  teamName: string;
  payPeriod: string;
  targetP: number;
  achievedP: number;
  achievementRate: number; // achievedP / targetP（小数、1.0 = 100%）
  memberCount: number;
  avgEfficiency: number;
}

// ============================================================
// 給与計算レコード
// ============================================================

export interface BudPayrollRecord {
  id: string;
  payPeriod: string;
  payDate: string;
  employeeId: string;

  salaryRecordId: string | null;

  // インセン 5 種
  apIncentive: number;
  caseIncentive: number;
  presidentIncentive: number;
  teamVictoryBonus: number;
  pAchievementBonus: number;

  // 部署別集計
  teamId: string | null;
  teamEfficiency: number | null;
  targetP: number | null;
  achievedP: number | null;
  achievementRate: number | null;

  // 集計結果
  totalTaxablePayment: number;
  totalNonTaxablePayment: number;
  totalDeduction: number;
  netPayment: number;

  // 計算スナップショット
  calculationSnapshot: Record<string, unknown>;
  calculationVersion: string;

  // ステータス + 監査
  status: PayrollRecordStatus;
  calculatedAt: string | null;
  calculatedBy: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  exportedAt: string | null;
  exportedToCsvId: string | null;
  confirmedByAuditorAt: string | null;
  confirmedByAuditorBy: string | null;
  visualDoubleCheckRequestedAt: string | null;
  visualDoubleCheckedAt: string | null;
  visualDoubleCheckedBy: string | null;
  visualCheckNote: string | null;
  sharoshiRequestSentAt: string | null;
  sharoshiPartnerId: string | null;
  confirmedBySharoshiAt: string | null;
  confirmedBySharoshiBy: string | null;
  sharoshiConfirmationNote: string | null;
  finalizedAt: string | null;
  finalizedBy: string | null;

  notes: string | null;
}
