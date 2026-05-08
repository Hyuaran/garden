/**
 * D-08 テスト戦略 / 勤怠 snapshot fixture 骨格
 *
 * 対応 spec: docs/specs/2026-04-25-bud-phase-d-08-test-strategy.md §2.2
 *
 * 勤怠取込（D-01）→ 給与計算（D-02）の入力で使用する代表パターン。
 * 単位は分（spec D-01 / D-02 統一）。
 */

export interface AttendanceSnapshotFixture {
  id: string;
  employeeId: string;
  fiscalYear: number;
  month: number; // 1-12
  calendarDays: number;
  workingDays: number;
  scheduledWorkingMinutes: number;
  actualWorkingMinutes: number;
  overtimeMinutes: number;
  lateNightMinutes: number;
  holidayWorkingMinutes: number;
  legalOvertimeMinutes: number;
  absentDays: number;
  lateMinutesTotal: number;
  earlyLeaveMinutesTotal: number;
}

const DEFAULT_ATTENDANCE: Omit<AttendanceSnapshotFixture, "id" | "employeeId"> =
  {
    fiscalYear: 2026,
    month: 4,
    calendarDays: 30,
    workingDays: 20,
    scheduledWorkingMinutes: 160 * 60,
    actualWorkingMinutes: 160 * 60,
    overtimeMinutes: 0,
    lateNightMinutes: 0,
    holidayWorkingMinutes: 0,
    legalOvertimeMinutes: 0,
    absentDays: 0,
    lateMinutesTotal: 0,
    earlyLeaveMinutesTotal: 0,
  };

export function buildAttendance(
  overrides: Partial<AttendanceSnapshotFixture> & {
    id: string;
    employeeId: string;
  },
): AttendanceSnapshotFixture {
  return { ...DEFAULT_ATTENDANCE, ...overrides };
}

// ============================================================
// 代表パターン
// ============================================================

export const fullMonthNoOvertime: AttendanceSnapshotFixture = buildAttendance({
  id: "fix-att-full",
  employeeId: "fix-r30k0t",
});

export const overtimeUnder60h: AttendanceSnapshotFixture = buildAttendance({
  id: "fix-att-ot40",
  employeeId: "fix-r30k0t",
  actualWorkingMinutes: 200 * 60,
  overtimeMinutes: 40 * 60, // 40h、60h 未満（25% 割増）
});

export const overtimeOver60h: AttendanceSnapshotFixture = buildAttendance({
  id: "fix-att-ot80",
  employeeId: "fix-r30k0t",
  actualWorkingMinutes: 240 * 60,
  overtimeMinutes: 80 * 60, // 80h（60h 超過 20h は 50% 割増）
});

export const overtimeAt60hBoundary: AttendanceSnapshotFixture = buildAttendance(
  {
    id: "fix-att-ot60",
    employeeId: "fix-r30k0t",
    actualWorkingMinutes: 220 * 60,
    overtimeMinutes: 60 * 60, // ちょうど 60h
  },
);

export const lateNightOnly: AttendanceSnapshotFixture = buildAttendance({
  id: "fix-att-late",
  employeeId: "fix-r30k0t",
  actualWorkingMinutes: 180 * 60,
  lateNightMinutes: 20 * 60, // 22-5 時 20h
});

export const absent5Days: AttendanceSnapshotFixture = buildAttendance({
  id: "fix-att-abs5",
  employeeId: "fix-r30k0t",
  workingDays: 15,
  actualWorkingMinutes: 120 * 60,
  absentDays: 5,
});

export const overtime100hError: AttendanceSnapshotFixture = buildAttendance({
  id: "fix-att-ot100",
  employeeId: "fix-r30k0t",
  actualWorkingMinutes: 260 * 60,
  overtimeMinutes: 100 * 60, // 100h 超は ERROR
});

export const overtime80hWarning: AttendanceSnapshotFixture = buildAttendance({
  id: "fix-att-ot85",
  employeeId: "fix-r30k0t",
  actualWorkingMinutes: 245 * 60,
  overtimeMinutes: 85 * 60, // 80h 超は WARNING
});

export const allAttendanceFixtures: AttendanceSnapshotFixture[] = [
  fullMonthNoOvertime,
  overtimeUnder60h,
  overtimeOver60h,
  overtimeAt60hBoundary,
  lateNightOnly,
  absent5Days,
  overtime100hError,
  overtime80hWarning,
];
