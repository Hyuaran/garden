/**
 * D-01 勤怠スナップショット整合性検査の単体テスト
 *
 * 対応 spec: docs/specs/2026-04-25-bud-phase-d-01-attendance-schema.md §5
 *
 * 網羅項目:
 *   1. 完全 OK（警告なし）
 *   2. 所定 vs 実労働の乖離 1h 超 → warning
 *   3. 残業 80h 超 → warning
 *   4. 残業 100h 超 → critical（locked 不可）
 *   5. 法定休日労働が出勤日数 × 24h 超 → error（取込中止）
 *   6. 出勤 + 欠勤 + 有給 が 31 日超 → error
 *   7. 半休 0.5 単位の境界
 *   8. shouldAbortImport / canLockSnapshot / maxWarningLevel ヘルパー
 */

import { describe, it, expect } from "vitest";
import {
  checkAttendanceIntegrity,
  shouldAbortImport,
  canLockSnapshot,
  maxWarningLevel,
  STANDARD_DAILY_WORKING_MINUTES,
  ATTENDANCE_TOLERANCE_MINUTES,
  OVERTIME_WARNING_THRESHOLD_MINUTES,
  OVERTIME_CRITICAL_THRESHOLD_MINUTES,
  CALENDAR_MAX_DAYS,
} from "../attendance-integrity";
import type {
  BudPayrollAttendanceSnapshot,
  AttendanceIntegrityWarning,
} from "../attendance-types";

// ------------------------------------------------------------
// テストヘルパー
// ------------------------------------------------------------

function buildSnapshot(
  overrides: Partial<BudPayrollAttendanceSnapshot> = {},
): BudPayrollAttendanceSnapshot {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    payrollPeriodId: "00000000-0000-0000-0000-000000000010",
    employeeId: "00000000-0000-0000-0000-000000000020",
    workingDays: 20,
    scheduledWorkingMinutes: 20 * STANDARD_DAILY_WORKING_MINUTES, // 9600
    actualWorkingMinutes: 20 * STANDARD_DAILY_WORKING_MINUTES, // 9600
    overtimeMinutes: 0,
    lateNightMinutes: 0,
    holidayWorkingMinutes: 0,
    legalOvertimeMinutes: 0,
    absentDays: 0,
    lateCount: 0,
    earlyLeaveCount: 0,
    lateMinutesTotal: 0,
    earlyLeaveMinutesTotal: 0,
    paidLeaveDays: 0,
    paidLeaveRemaining: 10,
    sourceRootAttendanceId: null,
    sourceSyncedAt: "2026-05-08T02:00:00Z",
    isLocked: false,
    notes: null,
    createdAt: "2026-05-08T02:00:00Z",
    updatedAt: "2026-05-08T02:00:00Z",
    ...overrides,
  };
}

function findWarning(
  warnings: AttendanceIntegrityWarning[],
  field: string,
): AttendanceIntegrityWarning | undefined {
  return warnings.find((w) => w.field === field);
}

// ============================================================
// 1. 完全 OK（警告なし）
// ============================================================

describe("checkAttendanceIntegrity - 正常ケース", () => {
  it("正常な勤怠（20 日、所定 = 実労働、残業 0、休日 0）→ 警告なし", () => {
    const snapshot = buildSnapshot();
    const warnings = checkAttendanceIntegrity(snapshot);
    expect(warnings).toEqual([]);
  });

  it("少しの所定乖離（59 分以内）→ 警告なし", () => {
    const snapshot = buildSnapshot({
      scheduledWorkingMinutes: 20 * STANDARD_DAILY_WORKING_MINUTES + 59,
    });
    const warnings = checkAttendanceIntegrity(snapshot);
    expect(findWarning(warnings, "scheduled_working_minutes")).toBeUndefined();
  });

  it("残業 79h（4740 分）→ 警告なし", () => {
    const snapshot = buildSnapshot({
      overtimeMinutes: 79 * 60,
    });
    const warnings = checkAttendanceIntegrity(snapshot);
    expect(findWarning(warnings, "overtime_minutes")).toBeUndefined();
  });
});

// ============================================================
// 2. 所定 vs 実労働の乖離（warning）
// ============================================================

describe("checkAttendanceIntegrity - 所定労働時間の乖離", () => {
  it("乖離が 60 分超（境界 +1 分）→ warning", () => {
    const snapshot = buildSnapshot({
      scheduledWorkingMinutes:
        20 * STANDARD_DAILY_WORKING_MINUTES + ATTENDANCE_TOLERANCE_MINUTES + 1,
    });
    const warnings = checkAttendanceIntegrity(snapshot);
    const w = findWarning(warnings, "scheduled_working_minutes");
    expect(w).toBeDefined();
    expect(w?.level).toBe("warning");
  });

  it("乖離が ちょうど 60 分 → 警告なし（境界）", () => {
    const snapshot = buildSnapshot({
      scheduledWorkingMinutes:
        20 * STANDARD_DAILY_WORKING_MINUTES + ATTENDANCE_TOLERANCE_MINUTES,
    });
    const warnings = checkAttendanceIntegrity(snapshot);
    expect(findWarning(warnings, "scheduled_working_minutes")).toBeUndefined();
  });

  it("出勤日数 0 で所定が 0 でない → 乖離あり警告", () => {
    const snapshot = buildSnapshot({
      workingDays: 0,
      scheduledWorkingMinutes: 480, // 0 日想定だが 8h 入っている
    });
    const warnings = checkAttendanceIntegrity(snapshot);
    expect(findWarning(warnings, "scheduled_working_minutes")?.level).toBe("warning");
  });
});

// ============================================================
// 3-4. 残業時間（80h / 100h 閾値）
// ============================================================

describe("checkAttendanceIntegrity - 残業閾値", () => {
  it("残業 80h ちょうど → 警告なし（境界、80h 超 で発火）", () => {
    const snapshot = buildSnapshot({
      overtimeMinutes: OVERTIME_WARNING_THRESHOLD_MINUTES,
    });
    const warnings = checkAttendanceIntegrity(snapshot);
    expect(findWarning(warnings, "overtime_minutes")).toBeUndefined();
  });

  it("残業 80h + 1 分 → warning", () => {
    const snapshot = buildSnapshot({
      overtimeMinutes: OVERTIME_WARNING_THRESHOLD_MINUTES + 1,
    });
    const warnings = checkAttendanceIntegrity(snapshot);
    const w = findWarning(warnings, "overtime_minutes");
    expect(w?.level).toBe("warning");
  });

  it("残業 100h ちょうど → warning（80h 超だが 100h 超ではない、境界）", () => {
    const snapshot = buildSnapshot({
      overtimeMinutes: OVERTIME_CRITICAL_THRESHOLD_MINUTES,
    });
    const warnings = checkAttendanceIntegrity(snapshot);
    expect(findWarning(warnings, "overtime_minutes")?.level).toBe("warning");
  });

  it("残業 100h + 1 分 → critical", () => {
    const snapshot = buildSnapshot({
      overtimeMinutes: OVERTIME_CRITICAL_THRESHOLD_MINUTES + 1,
    });
    const warnings = checkAttendanceIntegrity(snapshot);
    expect(findWarning(warnings, "overtime_minutes")?.level).toBe("critical");
  });

  it("残業 150h → critical + 過労死ライン明記", () => {
    const snapshot = buildSnapshot({
      overtimeMinutes: 150 * 60,
    });
    const warnings = checkAttendanceIntegrity(snapshot);
    const w = findWarning(warnings, "overtime_minutes");
    expect(w?.level).toBe("critical");
    expect(w?.message).toContain("過労死ライン");
  });
});

// ============================================================
// 5. 法定休日労働の物理的上限（error）
// ============================================================

describe("checkAttendanceIntegrity - 法定休日労働の上限", () => {
  it("休日労働 = 出勤日数 × 24h ちょうど → 警告なし（境界）", () => {
    const snapshot = buildSnapshot({
      holidayWorkingMinutes: 20 * 24 * 60,
    });
    const warnings = checkAttendanceIntegrity(snapshot);
    expect(findWarning(warnings, "holiday_working_minutes")).toBeUndefined();
  });

  it("休日労働 > 出勤日数 × 24h → error", () => {
    const snapshot = buildSnapshot({
      workingDays: 1,
      holidayWorkingMinutes: 25 * 60, // 1 日で 25h は不可能
    });
    const warnings = checkAttendanceIntegrity(snapshot);
    const w = findWarning(warnings, "holiday_working_minutes");
    expect(w?.level).toBe("error");
  });

  it("出勤 0 日で休日労働 1 分 → error", () => {
    const snapshot = buildSnapshot({
      workingDays: 0,
      holidayWorkingMinutes: 1,
    });
    const warnings = checkAttendanceIntegrity(snapshot);
    expect(findWarning(warnings, "holiday_working_minutes")?.level).toBe("error");
  });
});

// ============================================================
// 6. 日数合計の暦上限（error）
// ============================================================

describe("checkAttendanceIntegrity - 日数合計の上限", () => {
  it("出勤 20 + 欠勤 5 + 有給 5 = 30 日 → 警告なし", () => {
    const snapshot = buildSnapshot({
      workingDays: 20,
      absentDays: 5,
      paidLeaveDays: 5,
    });
    const warnings = checkAttendanceIntegrity(snapshot);
    expect(findWarning(warnings, "total_days_sum")).toBeUndefined();
  });

  it("出勤 20 + 欠勤 6 + 有給 5 = 31 日 ちょうど → 警告なし（境界）", () => {
    const snapshot = buildSnapshot({
      workingDays: 20,
      absentDays: 6,
      paidLeaveDays: 5,
    });
    const warnings = checkAttendanceIntegrity(snapshot);
    expect(findWarning(warnings, "total_days_sum")).toBeUndefined();
  });

  it("出勤 20 + 欠勤 7 + 有給 5 = 32 日 → error（暦超過）", () => {
    const snapshot = buildSnapshot({
      workingDays: 20,
      absentDays: 7,
      paidLeaveDays: 5,
    });
    const warnings = checkAttendanceIntegrity(snapshot);
    const w = findWarning(warnings, "total_days_sum");
    expect(w?.level).toBe("error");
  });

  it("半休 0.5 日 が ceil で切り上がる挙動", () => {
    const snapshot = buildSnapshot({
      workingDays: 20,
      absentDays: 6,
      paidLeaveDays: 4.5, // ceil → 5
    });
    const warnings = checkAttendanceIntegrity(snapshot);
    // 20 + 6 + 5(ceil(4.5)) = 31 → 境界 OK
    expect(findWarning(warnings, "total_days_sum")).toBeUndefined();
  });
});

// ============================================================
// 7. 実労働 vs 所定 の info 警告
// ============================================================

describe("checkAttendanceIntegrity - 実労働 vs 所定", () => {
  it("実労働 が 所定より 60 分超下回る → info", () => {
    const snapshot = buildSnapshot({
      scheduledWorkingMinutes: 9600,
      actualWorkingMinutes: 9600 - ATTENDANCE_TOLERANCE_MINUTES - 1,
    });
    const warnings = checkAttendanceIntegrity(snapshot);
    expect(findWarning(warnings, "actual_working_minutes")?.level).toBe("info");
  });

  it("実労働 = 所定 → 警告なし", () => {
    const snapshot = buildSnapshot({
      scheduledWorkingMinutes: 9600,
      actualWorkingMinutes: 9600,
    });
    const warnings = checkAttendanceIntegrity(snapshot);
    expect(findWarning(warnings, "actual_working_minutes")).toBeUndefined();
  });
});

// ============================================================
// 8. ヘルパー関数
// ============================================================

describe("shouldAbortImport", () => {
  it("error が 1 件あれば true", () => {
    const warnings: AttendanceIntegrityWarning[] = [
      { snapshotId: "x", level: "error", field: "holiday", message: "msg" },
    ];
    expect(shouldAbortImport(warnings)).toBe(true);
  });

  it("critical のみなら false（locked 不可だが取込は OK）", () => {
    const warnings: AttendanceIntegrityWarning[] = [
      { snapshotId: "x", level: "critical", field: "overtime", message: "msg" },
    ];
    expect(shouldAbortImport(warnings)).toBe(false);
  });

  it("空配列なら false", () => {
    expect(shouldAbortImport([])).toBe(false);
  });
});

describe("canLockSnapshot", () => {
  it("warning のみなら true（locked 可）", () => {
    const warnings: AttendanceIntegrityWarning[] = [
      { snapshotId: "x", level: "warning", field: "overtime", message: "msg" },
    ];
    expect(canLockSnapshot(warnings)).toBe(true);
  });

  it("critical があれば false（locked 不可）", () => {
    const warnings: AttendanceIntegrityWarning[] = [
      { snapshotId: "x", level: "critical", field: "overtime", message: "msg" },
    ];
    expect(canLockSnapshot(warnings)).toBe(false);
  });

  it("error があれば false", () => {
    const warnings: AttendanceIntegrityWarning[] = [
      { snapshotId: "x", level: "error", field: "holiday", message: "msg" },
    ];
    expect(canLockSnapshot(warnings)).toBe(false);
  });

  it("空配列なら true", () => {
    expect(canLockSnapshot([])).toBe(true);
  });
});

describe("maxWarningLevel", () => {
  it("混在: error > critical > warning > info の順", () => {
    const warnings: AttendanceIntegrityWarning[] = [
      { snapshotId: "x", level: "info", field: "a", message: "" },
      { snapshotId: "x", level: "warning", field: "b", message: "" },
      { snapshotId: "x", level: "error", field: "c", message: "" },
      { snapshotId: "x", level: "critical", field: "d", message: "" },
    ];
    expect(maxWarningLevel(warnings)).toBe("error");
  });

  it("空配列なら null", () => {
    expect(maxWarningLevel([])).toBeNull();
  });

  it("info のみ → info", () => {
    const warnings: AttendanceIntegrityWarning[] = [
      { snapshotId: "x", level: "info", field: "a", message: "" },
    ];
    expect(maxWarningLevel(warnings)).toBe("info");
  });
});

// ============================================================
// 9. 統合シナリオ
// ============================================================

describe("checkAttendanceIntegrity - 統合シナリオ", () => {
  it("正常な月給与勤怠（22 営業日 + 残業 30h + 有給 1 日）", () => {
    const snapshot = buildSnapshot({
      workingDays: 22,
      scheduledWorkingMinutes: 22 * STANDARD_DAILY_WORKING_MINUTES,
      actualWorkingMinutes: 22 * STANDARD_DAILY_WORKING_MINUTES + 30 * 60,
      overtimeMinutes: 30 * 60,
      paidLeaveDays: 1,
      paidLeaveRemaining: 9,
    });
    const warnings = checkAttendanceIntegrity(snapshot);
    expect(warnings).toEqual([]);
    expect(canLockSnapshot(warnings)).toBe(true);
  });

  it("過酷な月（残業 110h + 暦超過なし）→ critical 1 件、locked 不可", () => {
    const snapshot = buildSnapshot({
      workingDays: 22,
      scheduledWorkingMinutes: 22 * STANDARD_DAILY_WORKING_MINUTES,
      actualWorkingMinutes: 22 * STANDARD_DAILY_WORKING_MINUTES + 110 * 60,
      overtimeMinutes: 110 * 60,
    });
    const warnings = checkAttendanceIntegrity(snapshot);
    expect(maxWarningLevel(warnings)).toBe("critical");
    expect(canLockSnapshot(warnings)).toBe(false);
    expect(shouldAbortImport(warnings)).toBe(false);
  });

  it("不正データ（暦超過 + 休日労働超過）→ error 2 件、取込中止", () => {
    const snapshot = buildSnapshot({
      workingDays: 25,
      absentDays: 5,
      paidLeaveDays: 5, // 25+5+5 = 35 > 31
      holidayWorkingMinutes: 30 * 24 * 60, // 25 日 × 24h を超過
    });
    const warnings = checkAttendanceIntegrity(snapshot);
    expect(shouldAbortImport(warnings)).toBe(true);
    expect(maxWarningLevel(warnings)).toBe("error");
  });
});
