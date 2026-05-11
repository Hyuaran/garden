/**
 * Garden-Bud / Phase D #12 給与処理スケジュール + リマインダ 純関数
 *
 * 対応 spec: docs/specs/2026-04-26-bud-phase-d-12-payroll-schedule-reminder.md §4
 *
 * 純関数のみ。Server Action / Cron からは設定 + 期間 + 現在時刻を渡して呼ぶ。
 *
 * 範囲:
 *   - stage offset 計算（営業日ベース、business-day.ts 流用）
 *   - period_end → 各 stage 予定日の生成（generateScheduleForPeriod 純関数版）
 *   - severity 判定（info / warning / critical）
 *   - escalation 判定（0 / 1 / 2）
 *   - 受信者解決（stage 担当 + escalation 強化）
 *   - リマインダメッセージテンプレ
 */

import { nextBusinessDay, parseIsoDate } from "../../transfers/_lib/business-day";
import {
  type ScheduleStage,
  type BudPayrollScheduleSettings,
  type ReminderSeverity,
  STAGE_DEPENDENCIES,
} from "./schedule-types";

// ============================================================
// 1. stage offset → 予定日計算
// ============================================================

/**
 * 指定 stage の offset_days を settings から取得。
 */
export function getStageOffsetDays(
  stage: ScheduleStage,
  settings: BudPayrollScheduleSettings,
): number {
  const offsetMap: Record<ScheduleStage, number> = {
    calculation: settings.calculationOffsetDays,
    approval: settings.approvalOffsetDays,
    mfc_import: settings.mfcImportOffsetDays,
    audit: settings.auditOffsetDays,
    visual_double_check: settings.visualDoubleCheckOffsetDays,
    sharoshi_check: settings.sharoshiCheckOffsetDays,
    finalization: settings.finalizationOffsetDays,
  };
  return offsetMap[stage];
}

/**
 * 起点日から N 営業日後を計算（週末スキップ）。
 *
 * @param baseDate 起点日（前 stage 完了日 or period_end）
 * @param businessDaysOffset 営業日数（>= 0）
 * @returns N 営業日後の Date
 */
export function addBusinessDays(baseDate: Date, businessDaysOffset: number): Date {
  if (businessDaysOffset <= 0) return new Date(baseDate);
  let current = new Date(baseDate);
  for (let i = 0; i < businessDaysOffset; i++) {
    current = nextBusinessDay(current);
  }
  return current;
}

/**
 * Date を YYYY-MM-DD 文字列にフォーマット。
 */
export function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ============================================================
// 2. period_end → 7 stage 予定日 一括生成
// ============================================================

export interface ScheduleGenerationInput {
  /** 給与期間の最終日（YYYY-MM-DD）*/
  periodEnd: string;
  /** スケジュール設定（offset_days × 7 stage 含む）*/
  settings: BudPayrollScheduleSettings;
}

export interface GeneratedSchedule {
  stage: ScheduleStage;
  plannedDate: string; // YYYY-MM-DD
}

/**
 * period_end → 7 stage の予定日を一括生成。
 * 各 stage は前 stage の予定日から offset 営業日後（calculation のみ period_end 起点）。
 *
 * @returns 7 stage の plannedDate（spec § 2.1 順序）
 */
export function generateScheduleForPeriod(
  input: ScheduleGenerationInput,
): GeneratedSchedule[] {
  const baseDate = parseIsoDate(input.periodEnd);
  if (!baseDate) {
    throw new Error(`Invalid periodEnd: ${input.periodEnd}`);
  }

  const result: GeneratedSchedule[] = [];
  const stageDates = new Map<ScheduleStage | "period_end", Date>();
  stageDates.set("period_end", baseDate);

  for (const dep of STAGE_DEPENDENCIES) {
    const baseStage = stageDates.get(dep.basedOn);
    if (!baseStage) {
      throw new Error(`Stage dependency not found: ${dep.stage} based on ${dep.basedOn}`);
    }
    const offset = getStageOffsetDays(dep.stage, input.settings);
    const plannedDate = addBusinessDays(baseStage, offset);
    stageDates.set(dep.stage, plannedDate);
    result.push({ stage: dep.stage, plannedDate: formatYmd(plannedDate) });
  }

  return result;
}

// ============================================================
// 3. severity 判定（info / warning / critical）
// ============================================================

export interface SeverityInput {
  /** 予定日に対する経過時間（時間単位）。負数 = 予定日未到達 */
  hoursOverdue: number;
  /** 警告閾値（時間）*/
  warnAfterHours: number;
  /** 重大閾値（時間）*/
  criticalAfterHours: number;
}

/**
 * 経過時間に基づいて severity を判定。
 *
 * - hoursOverdue < 0（予定日未到達）→ 'info'
 * - 0 <= hoursOverdue < warnAfterHours → 'info'
 * - warnAfterHours <= hoursOverdue < criticalAfterHours → 'warning'
 * - criticalAfterHours <= hoursOverdue → 'critical'
 */
export function decideSeverity(input: SeverityInput): ReminderSeverity {
  if (input.hoursOverdue < input.warnAfterHours) return "info";
  if (input.hoursOverdue < input.criticalAfterHours) return "warning";
  return "critical";
}

/**
 * 予定日 + 現在時刻から経過時間を計算（時間単位）。
 * 予定日未到達なら負数。
 */
export function calculateHoursOverdue(
  plannedDate: string,
  now: Date = new Date(),
): number {
  const planned = parseIsoDate(plannedDate);
  if (!planned) return 0;
  // 予定日の終わり（23:59:59）を基準にする運用も可だが、シンプルに 0:00 起点
  const diffMs = now.getTime() - planned.getTime();
  return diffMs / (60 * 60 * 1000);
}

// ============================================================
// 4. escalation 判定（0 / 1 / 2）
// ============================================================

export interface EscalationInput {
  /** 予定日からの経過日数 */
  daysOverdue: number;
  /** 東海林 DM 閾値（日）*/
  escalationAfterDays: number;
  /** 全社員通知閾値（日）*/
  fullCompanyNotifyAfterDays: number;
}

/**
 * escalation level を判定。
 *
 * - daysOverdue < escalationAfterDays → 0（通常、担当者のみ）
 * - escalationAfterDays <= daysOverdue < fullCompanyNotifyAfterDays → 1（東海林 DM）
 * - fullCompanyNotifyAfterDays <= daysOverdue → 2（全社員通知）
 */
export function decideEscalationLevel(input: EscalationInput): number {
  if (input.daysOverdue < input.escalationAfterDays) return 0;
  if (input.daysOverdue < input.fullCompanyNotifyAfterDays) return 1;
  return 2;
}

/**
 * hours → days 変換（24 時間 = 1 日）。
 */
export function hoursToDays(hours: number): number {
  return hours / 24;
}

// ============================================================
// 5. 受信者解決
// ============================================================

export interface RecipientResolutionInput {
  /** stage 担当者 ID（employee）*/
  assignedToEmployeeId: string | null;
  /** stage 担当 partner ID（社労士、stage='sharoshi_check' のみ）*/
  assignedToPartnerId: string | null;
  /** escalation level */
  escalationLevel: number;
  /** 東海林 ID（escalation=1+ で追加）*/
  auditorEmployeeId: string;
  /** 全社員 ID リスト（escalation=2 で全員に通知）*/
  allEmployeeIds: string[];
}

export interface ResolvedRecipients {
  employeeIds: string[];
  partnerId: string | null;
}

/**
 * escalation level に応じた受信者を解決。
 *
 * - level 0: 担当者のみ
 * - level 1: 担当者 + 東海林（重複排除）
 * - level 2: 全社員（東海林・担当者含む全員、partner も含む）
 */
export function resolveRecipients(
  input: RecipientResolutionInput,
): ResolvedRecipients {
  const employeeIds = new Set<string>();

  if (input.assignedToEmployeeId) {
    employeeIds.add(input.assignedToEmployeeId);
  }

  if (input.escalationLevel >= 1) {
    employeeIds.add(input.auditorEmployeeId);
  }

  if (input.escalationLevel >= 2) {
    for (const empId of input.allEmployeeIds) {
      employeeIds.add(empId);
    }
  }

  return {
    employeeIds: Array.from(employeeIds),
    partnerId: input.assignedToPartnerId, // 社労士 stage の場合のみ
  };
}

// ============================================================
// 6. リマインダメッセージテンプレ（stage × severity）
// ============================================================

interface MessageTemplate {
  info: string;
  warning: string;
  critical: string;
}

/**
 * stage × severity の標準メッセージテンプレ（spec § 4.3 + 4 次 follow-up）。
 * placeholders: {date} / {hours} / {assignee} / {partner_name}
 */
export const REMINDER_TEMPLATES: Record<ScheduleStage, MessageTemplate> = {
  calculation: {
    info: "{date} に給与計算開始予定です。{assignee} さん、準備をお願いします。",
    warning:
      "給与計算が予定日を {hours}h 超過しています。{assignee} さん、開始してください。",
    critical:
      "⚠️ 給与計算が {hours}h 遅延しています。早急な対応が必要です。{assignee} さん、よろしくお願いします。",
  },
  approval: {
    info: "本日 {date} は給与承認予定日です。{assignee} さん、内容確認をお願いします。",
    warning:
      "承認待ちが {hours}h 経過しています。{assignee} さん、確認してください。",
    critical:
      "🔴 承認待ちが {hours}h 経過。給与振込スケジュールに影響します。{assignee} さん、即対応をお願いします。",
  },
  mfc_import: {
    info: "本日 {date} は MFC 取込予定日です。{assignee} さん、CSV 生成と取込をお願いします。",
    warning: "MFC 取込が {hours}h 遅延。{assignee} さん、実行してください。",
    critical: "🔴 MFC 取込が {hours}h 遅延。給与振込日に間に合わない可能性。",
  },
  audit: {
    info: "本日 {date} は給与目視確認予定日です。東海林さん、ご確認をお願いします。",
    warning: "目視確認待ちが {hours}h 経過。",
    critical: "🔴 目視確認が {hours}h 遅延。",
  },
  visual_double_check: {
    info: "本日 {date} は上田君の目視ダブルチェック予定日です。{assignee} さん、金額・氏名・口座を 1 件ずつご確認をお願いします（時間かかってもよいです）。",
    warning:
      "目視ダブルチェックが {hours}h 経過しています。{assignee} さん、ご対応をお願いします。",
    critical:
      "🔴 目視ダブルチェックが {hours}h 遅延。振込日に影響します。{assignee} さん、最優先でお願いします。",
  },
  sharoshi_check: {
    info: "社労士確認依頼の予定日です。東海林さん、{partner_name} へ確認依頼をお願いします。",
    warning:
      "社労士確認依頼から {hours}h 経過しています。{partner_name} への状況確認をご検討ください。",
    critical:
      "🔴 社労士確認待ちが {hours}h 経過。{partner_name} へ催促をお願いします。",
  },
  finalization: {
    info: "本日 {date} は給与確定予定日です。東海林さん、最終処理をお願いします。",
    warning: "給与確定が {hours}h 遅延。",
    critical:
      "🔴 給与確定が {hours}h 遅延。**振込日に影響大**。即対応必要。",
  },
};

export interface MessageRenderInput {
  stage: ScheduleStage;
  severity: ReminderSeverity;
  plannedDate: string;
  hoursOverdue: number;
  assigneeName: string;
  partnerName: string | null;
}

/**
 * テンプレに値を埋め込んで送信文を生成。
 */
export function renderReminderMessage(input: MessageRenderInput): string {
  const tpl = REMINDER_TEMPLATES[input.stage][input.severity];
  return tpl
    .replaceAll("{date}", input.plannedDate)
    .replaceAll("{hours}", Math.floor(Math.max(input.hoursOverdue, 0)).toString())
    .replaceAll("{assignee}", input.assigneeName)
    .replaceAll("{partner_name}", input.partnerName ?? "（社労士未登録）");
}

// ============================================================
// 7. status 自動判定（スケジュールから）
// ============================================================

export interface StatusDecisionInput {
  /** 予定日 */
  plannedDate: string;
  /** 実績日（完了時のみ）*/
  actualDate: string | null;
  /** 現在時刻 */
  now?: Date;
}

/**
 * schedule の status を自動判定:
 *   - actualDate があれば 'completed'
 *   - 予定日未到達 → 'not_started'
 *   - 予定日到達済 + 未完了 → 'in_progress' or 'overdue'
 *     - hoursOverdue < 24 → 'in_progress'（当日中）
 *     - hoursOverdue >= 24 → 'overdue'
 */
export function decideScheduleStatus(input: StatusDecisionInput) {
  const now = input.now ?? new Date();
  if (input.actualDate !== null) return "completed" as const;

  const hoursOverdue = calculateHoursOverdue(input.plannedDate, now);
  if (hoursOverdue < 0) return "not_started" as const;
  if (hoursOverdue < 24) return "in_progress" as const;
  return "overdue" as const;
}
