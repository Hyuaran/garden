/**
 * Garden-Bud / Phase D #12 給与処理スケジュール + リマインダ TypeScript 型定義
 *
 * 対応 spec: docs/specs/2026-04-26-bud-phase-d-12-payroll-schedule-reminder.md
 * 対応 migration: supabase/migrations/20260508000003_bud_phase_d12_payroll_schedule_reminder.sql
 *
 * 4 次 follow-up Cat 4 #26: 7 stage 対応（visual_double_check 含む）。
 */

// ============================================================
// 列挙型
// ============================================================

export const SCHEDULE_STAGES = [
  "calculation",
  "approval",
  "mfc_import",
  "audit",
  "visual_double_check", // 4 次 follow-up Cat 4 #26
  "sharoshi_check",
  "finalization",
] as const;
export type ScheduleStage = (typeof SCHEDULE_STAGES)[number];

export const SCHEDULE_STATUSES = [
  "not_started",
  "in_progress",
  "completed",
  "overdue",
] as const;
export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

export const REMINDER_SEVERITIES = ["info", "warning", "critical"] as const;
export type ReminderSeverity = (typeof REMINDER_SEVERITIES)[number];

export const REMINDER_CHANNELS = [
  "chatwork_dm",
  "garden_toast",
  "email",
  "multi",
] as const;
export type ReminderChannel = (typeof REMINDER_CHANNELS)[number];

export const REMINDER_LOG_STATUSES = ["sent", "failed", "partial"] as const;
export type ReminderLogStatus = (typeof REMINDER_LOG_STATUSES)[number];

// ============================================================
// スケジュール設定
// ============================================================

export interface BudPayrollScheduleSettings {
  id: string;
  companyId: string | null; // null = 全法人共通

  // 各 stage の offset（営業日数）
  calculationOffsetDays: number;
  approvalOffsetDays: number;
  mfcImportOffsetDays: number;
  auditOffsetDays: number;
  visualDoubleCheckOffsetDays: number; // 4 次 follow-up
  sharoshiCheckOffsetDays: number;
  finalizationOffsetDays: number;

  // 担当者デフォルト
  defaultCalculatorId: string | null;
  defaultApproverIds: string[];
  defaultDisburserId: string | null;
  defaultAuditorId: string | null;
  defaultVisualCheckerId: string | null; // 4 次 follow-up
  defaultSharoshiPartnerId: string | null;

  // リマインダ閾値
  warnAfterHours: number;
  criticalAfterHours: number;
  escalationAfterDays: number;
  fullCompanyNotifyAfterDays: number;

  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  updatedBy: string;
}

// ============================================================
// スケジュールレコード
// ============================================================

export interface BudPayrollSchedule {
  id: string;
  periodId: string;
  stage: ScheduleStage;
  plannedDate: string; // YYYY-MM-DD
  actualDate: string | null;
  assignedToEmployeeId: string | null;
  assignedToPartnerId: string | null;
  status: ScheduleStatus;
  reminderCount: number;
  lastReminderSentAt: string | null;
  escalationLevel: number; // 0 / 1 / 2
  notes: string | null;
}

// ============================================================
// リマインダログ
// ============================================================

export interface BudPayrollReminderLog {
  id: string;
  scheduleId: string;
  sentAt: string;
  severity: ReminderSeverity;
  escalationLevel: number;
  notifiedEmployeeIds: string[];
  notifiedPartnerId: string | null;
  channel: ReminderChannel;
  messageText: string;
  externalMessageIds: Record<string, string> | null;
  status: ReminderLogStatus;
  failedReason: string | null;
}

// ============================================================
// stage の offset 順序（spec § 2.1 表）
// ============================================================

/**
 * 各 stage は前段階の完了日 から offset 営業日後（spec § 2.1）。
 * 累計目安: period_end + 10 営業日（4 次 follow-up）。
 */
export interface StageDependency {
  stage: ScheduleStage;
  /** 起点の stage（previous stage の完了日が起点）。null = period_end 起点 */
  basedOn: ScheduleStage | "period_end";
}

export const STAGE_DEPENDENCIES: readonly StageDependency[] = [
  { stage: "calculation", basedOn: "period_end" },
  { stage: "approval", basedOn: "calculation" },
  { stage: "mfc_import", basedOn: "approval" },
  { stage: "audit", basedOn: "mfc_import" },
  { stage: "visual_double_check", basedOn: "audit" }, // 4 次 follow-up
  { stage: "sharoshi_check", basedOn: "visual_double_check" },
  { stage: "finalization", basedOn: "sharoshi_check" },
] as const;
