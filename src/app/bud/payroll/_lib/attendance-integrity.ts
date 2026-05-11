/**
 * Garden-Bud / Phase D #01 勤怠スナップショット整合性検査
 *
 * 対応 spec: docs/specs/2026-04-25-bud-phase-d-01-attendance-schema.md §5
 *
 * spec §5.2 警告レベル:
 *   info / warning: snapshot 作成、レビュー必須
 *   critical: snapshot 一時保留（locked 不可）
 *   error: 取込中止、KoT 側修正依頼
 *
 * 純関数のみ（DB アクセスなし）。Cron / Server Action から呼び出して使う想定。
 */

import type {
  BudPayrollAttendanceSnapshot,
  AttendanceIntegrityWarning,
  AttendanceWarningLevel,
} from "./attendance-types";

// ============================================================
// 閾値定数（spec §5.2 / §5.3 反映）
// ============================================================

/** 1 日あたり所定労働時間の上限（8 時間 = 480 分） */
export const STANDARD_DAILY_WORKING_MINUTES = 8 * 60;

/** 所定 vs 実労働の許容乖離（1 時間 = 60 分） */
export const ATTENDANCE_TOLERANCE_MINUTES = 60;

/** 月 80h 超の残業は警告（過労死ライン手前） */
export const OVERTIME_WARNING_THRESHOLD_MINUTES = 80 * 60;

/** 月 100h 超の残業は重大（過労死ライン） */
export const OVERTIME_CRITICAL_THRESHOLD_MINUTES = 100 * 60;

/**
 * 暦日数の上限（月単位）。最大 31 日として運用。
 * snapshot.working_days + absent_days + paid_leave_days がこの値を超えたらエラー。
 */
export const CALENDAR_MAX_DAYS = 31;

// ============================================================
// 検査ヘルパー
// ============================================================

interface CheckContext {
  snapshot: BudPayrollAttendanceSnapshot;
  warnings: AttendanceIntegrityWarning[];
}

function pushWarning(
  ctx: CheckContext,
  level: AttendanceWarningLevel,
  field: string,
  message: string,
): void {
  ctx.warnings.push({
    snapshotId: ctx.snapshot.id,
    level,
    field,
    message,
  });
}

// ------------------------------------------------------------
// 検査 1: 所定労働時間 vs 実労働時間 の乖離
// ------------------------------------------------------------
function checkWorkingMinutesGap(ctx: CheckContext): void {
  const expectedMinutes = ctx.snapshot.workingDays * STANDARD_DAILY_WORKING_MINUTES;
  const diff = Math.abs(expectedMinutes - ctx.snapshot.scheduledWorkingMinutes);
  if (diff > ATTENDANCE_TOLERANCE_MINUTES) {
    pushWarning(
      ctx,
      "warning",
      "scheduled_working_minutes",
      `所定労働時間 (${ctx.snapshot.scheduledWorkingMinutes} 分) と出勤日数 × 8h (${expectedMinutes} 分) の差分が ${diff} 分（許容 ${ATTENDANCE_TOLERANCE_MINUTES} 分超）`,
    );
  }
}

// ------------------------------------------------------------
// 検査 2: 残業時間（80h / 100h 閾値）
// ------------------------------------------------------------
function checkOvertimeThreshold(ctx: CheckContext): void {
  const ot = ctx.snapshot.overtimeMinutes;
  if (ot > OVERTIME_CRITICAL_THRESHOLD_MINUTES) {
    pushWarning(
      ctx,
      "critical",
      "overtime_minutes",
      `残業時間 ${(ot / 60).toFixed(1)} 時間が過労死ライン (100h) を超過。snapshot 一時保留、HR 緊急確認必須。`,
    );
  } else if (ot > OVERTIME_WARNING_THRESHOLD_MINUTES) {
    pushWarning(
      ctx,
      "warning",
      "overtime_minutes",
      `残業時間 ${(ot / 60).toFixed(1)} 時間が 80h を超過。HR 確認推奨。`,
    );
  }
}

// ------------------------------------------------------------
// 検査 3: 法定休日労働時間が出勤日数 × 24h を超えない
// ------------------------------------------------------------
function checkHolidayWorkingBound(ctx: CheckContext): void {
  const maxHolidayMinutes = ctx.snapshot.workingDays * 24 * 60;
  if (ctx.snapshot.holidayWorkingMinutes > maxHolidayMinutes) {
    pushWarning(
      ctx,
      "error",
      "holiday_working_minutes",
      `法定休日労働 ${ctx.snapshot.holidayWorkingMinutes} 分が出勤日数 × 24h (${maxHolidayMinutes} 分) を超過。物理的に不可、KoT 側修正依頼。`,
    );
  }
}

// ------------------------------------------------------------
// 検査 4: 出勤日数 + 欠勤日数 + 有給日数 が暦日数を超えない
// ------------------------------------------------------------
function checkDayCountSum(ctx: CheckContext): void {
  // paid_leave_days は numeric(4,2)、半休 0.5 単位。整数化のため Math.ceil
  const totalDaysApprox =
    ctx.snapshot.workingDays +
    ctx.snapshot.absentDays +
    Math.ceil(ctx.snapshot.paidLeaveDays);
  if (totalDaysApprox > CALENDAR_MAX_DAYS) {
    pushWarning(
      ctx,
      "error",
      "total_days_sum",
      `出勤 ${ctx.snapshot.workingDays} + 欠勤 ${ctx.snapshot.absentDays} + 有給 ${ctx.snapshot.paidLeaveDays} = ${totalDaysApprox} 日が暦上限 ${CALENDAR_MAX_DAYS} 日を超過。取込中止、KoT 側修正依頼。`,
    );
  }
}

// ------------------------------------------------------------
// 検査 5: actual_working_minutes が overtime / late_night / holiday を含む整合
// ------------------------------------------------------------
function checkActualVsComponents(ctx: CheckContext): void {
  // late_night / holiday は actual の内訳ではない（重複カウントあり）ので
  // 基本: scheduled <= actual のチェックのみ
  if (ctx.snapshot.actualWorkingMinutes < ctx.snapshot.scheduledWorkingMinutes - ATTENDANCE_TOLERANCE_MINUTES) {
    pushWarning(
      ctx,
      "info",
      "actual_working_minutes",
      `実労働時間 (${ctx.snapshot.actualWorkingMinutes} 分) が所定 (${ctx.snapshot.scheduledWorkingMinutes} 分) を ${ctx.snapshot.scheduledWorkingMinutes - ctx.snapshot.actualWorkingMinutes} 分以上下回る。早退・欠勤の合計と整合確認推奨。`,
    );
  }
}

// ============================================================
// 公開 API: 全検査をまとめて実行
// ============================================================

/**
 * snapshot に対して全整合性検査を実行し、警告リストを返す。
 *
 * 戻り値の `level` 含む warnings を確認:
 *   - 'error' を含む → 取込中止（caller 側で判断）
 *   - 'critical' を含む → snapshot 一時保留（locked 不可）
 *   - 'warning' / 'info' のみ → snapshot 作成可、レビュー対象
 *
 * @param snapshot 検査対象の勤怠スナップショット
 * @returns 警告のリスト（空 = 完全 OK）
 */
export function checkAttendanceIntegrity(
  snapshot: BudPayrollAttendanceSnapshot,
): AttendanceIntegrityWarning[] {
  const ctx: CheckContext = { snapshot, warnings: [] };
  checkWorkingMinutesGap(ctx);
  checkOvertimeThreshold(ctx);
  checkHolidayWorkingBound(ctx);
  checkDayCountSum(ctx);
  checkActualVsComponents(ctx);
  return ctx.warnings;
}

/**
 * 警告リストから「取込中止すべきか」判定。
 * spec §5.2: 'error' レベルが 1 件でも → 取込中止。
 */
export function shouldAbortImport(warnings: AttendanceIntegrityWarning[]): boolean {
  return warnings.some((w) => w.level === "error");
}

/**
 * 警告リストから「snapshot を locked にできるか」判定。
 * spec §5.2: 'critical' / 'error' が含まれる → locked 不可（一時保留）。
 */
export function canLockSnapshot(warnings: AttendanceIntegrityWarning[]): boolean {
  return !warnings.some((w) => w.level === "critical" || w.level === "error");
}

/**
 * 警告リストから最大重大度を返す。
 */
export function maxWarningLevel(
  warnings: AttendanceIntegrityWarning[],
): AttendanceWarningLevel | null {
  if (warnings.length === 0) return null;
  if (warnings.some((w) => w.level === "error")) return "error";
  if (warnings.some((w) => w.level === "critical")) return "critical";
  if (warnings.some((w) => w.level === "warning")) return "warning";
  return "info";
}
