/**
 * Garden-Bud / Phase D #01 給与勤怠スキーマ TypeScript 型定義
 *
 * 対応 spec: docs/specs/2026-04-25-bud-phase-d-01-attendance-schema.md
 * 対応 migration: supabase/migrations/20260507000001_bud_phase_d01_attendance_schema.sql
 *
 * 役割:
 *   - DB スキーマと TS 型の 1:1 対応を保証
 *   - 単位（分・日）の意味を型レベルで明示（Branded type は将来検討）
 *   - 列挙型（period_type / status）の constants 提供
 */

// ============================================================
// 列挙型 constants（DB CHECK 制約と完全一致）
// ============================================================

export const PAYROLL_PERIOD_TYPES = [
  "monthly",
  "bonus_summer",
  "bonus_winter",
  "final_settlement",
] as const;

export type PayrollPeriodType = (typeof PAYROLL_PERIOD_TYPES)[number];

export const PAYROLL_PERIOD_STATUSES = [
  "draft", // 期間定義のみ
  "locked", // 締日確定 + スナップショット完了
  "calculated", // 給与計算完了
  "approved", // 承認済（振込実行直前）
  "paid", // 振込実行済
] as const;

export type PayrollPeriodStatus = (typeof PAYROLL_PERIOD_STATUSES)[number];

// ============================================================
// bud_payroll_periods（給与計算期間）
// ============================================================

export interface BudPayrollPeriod {
  id: string;
  companyId: string;
  periodType: PayrollPeriodType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD（end_date < cutoff_date）
  cutoffDate: string; // YYYY-MM-DD（cutoff_date <= payment_date）
  paymentDate: string; // YYYY-MM-DD（翌月末営業日が標準）
  statementPublishTargetDate: string | null; // 明細配信目安、null=未設定
  status: PayrollPeriodStatus;
  lockedAt: string | null;
  lockedBy: string | null;
  notes: string | null;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
}

// ============================================================
// bud_payroll_attendance_snapshots（勤怠スナップショット）
// ============================================================

export interface BudPayrollAttendanceSnapshot {
  id: string;
  payrollPeriodId: string;
  employeeId: string;

  // 出勤・労働時間（全て分単位）
  workingDays: number; // 0..31
  scheduledWorkingMinutes: number;
  actualWorkingMinutes: number;
  overtimeMinutes: number;
  lateNightMinutes: number; // 22:00〜5:00
  holidayWorkingMinutes: number; // 法定休日労働
  legalOvertimeMinutes: number; // 法定外休日労働

  // 欠勤・控除
  absentDays: number; // 0..31
  lateCount: number;
  earlyLeaveCount: number;
  lateMinutesTotal: number;
  earlyLeaveMinutesTotal: number;

  // 有給（半休 0.5 日 単位許容）
  paidLeaveDays: number; // 0..31, 0.5 刻み
  paidLeaveRemaining: number | null; // スナップショット時点の残

  // ソース追跡
  sourceRootAttendanceId: string | null;
  sourceSyncedAt: string;

  // メタ
  isLocked: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// bud_payroll_attendance_overrides（締日後の修正履歴）
// ============================================================

export interface BudPayrollAttendanceOverride {
  id: string;
  snapshotId: string;
  changedField: string; // 例: 'overtime_minutes', 'paid_leave_days'
  oldValue: unknown; // jsonb（型は変更フィールド依存）
  newValue: unknown;
  reason: string; // CHECK: length >= 5
  approvedBy: string;
  approvedAt: string;
  auditLogId: string | null;
}

// ============================================================
// 警告レベル（spec §5.2 反映）
// ============================================================

export const ATTENDANCE_WARNING_LEVELS = ["info", "warning", "critical", "error"] as const;
export type AttendanceWarningLevel = (typeof ATTENDANCE_WARNING_LEVELS)[number];

export interface AttendanceIntegrityWarning {
  snapshotId: string;
  level: AttendanceWarningLevel;
  field: string;
  message: string;
  /**
   * critical: snapshot 一時保留（locked 不可）
   * error: 取込中止、KoT 側修正依頼
   * warning: snapshot 作成、レビュー必須
   * info: snapshot 作成、参考情報
   */
}
