/**
 * D-12 給与処理スケジュール + リマインダ 単体テスト
 *
 * 対応 spec: docs/specs/2026-04-26-bud-phase-d-12-payroll-schedule-reminder.md
 *
 * 網羅項目:
 *   1. getStageOffsetDays
 *   2. addBusinessDays / formatYmd（週末スキップ）
 *   3. generateScheduleForPeriod（7 stage 累計目安 10 営業日）
 *   4. decideSeverity（info / warning / critical）
 *   5. calculateHoursOverdue
 *   6. decideEscalationLevel（0 / 1 / 2）
 *   7. resolveRecipients（escalation 強化）
 *   8. renderReminderMessage（テンプレ + placeholder 置換）
 *   9. decideScheduleStatus（auto status from schedule）
 */

import { describe, it, expect } from "vitest";
import {
  getStageOffsetDays,
  addBusinessDays,
  formatYmd,
  generateScheduleForPeriod,
  decideSeverity,
  calculateHoursOverdue,
  decideEscalationLevel,
  resolveRecipients,
  renderReminderMessage,
  decideScheduleStatus,
  REMINDER_TEMPLATES,
} from "../schedule-functions";
import {
  type BudPayrollScheduleSettings,
  STAGE_DEPENDENCIES,
  SCHEDULE_STAGES,
} from "../schedule-types";

// ============================================================
// テストフィクスチャ
// ============================================================

function buildSettings(
  overrides: Partial<BudPayrollScheduleSettings> = {},
): BudPayrollScheduleSettings {
  return {
    id: "settings-1",
    companyId: null,
    calculationOffsetDays: 2,
    approvalOffsetDays: 1,
    mfcImportOffsetDays: 1,
    auditOffsetDays: 1,
    visualDoubleCheckOffsetDays: 1,
    sharoshiCheckOffsetDays: 3,
    finalizationOffsetDays: 1,
    defaultCalculatorId: null,
    defaultApproverIds: [],
    defaultDisburserId: null,
    defaultAuditorId: null,
    defaultVisualCheckerId: null,
    defaultSharoshiPartnerId: null,
    warnAfterHours: 24,
    criticalAfterHours: 72,
    escalationAfterDays: 3,
    fullCompanyNotifyAfterDays: 5,
    effectiveFrom: "2026-04-01",
    effectiveTo: null,
    createdAt: "2026-04-01T00:00:00Z",
    updatedBy: "admin",
    ...overrides,
  };
}

// ============================================================
// 1. getStageOffsetDays
// ============================================================

describe("getStageOffsetDays", () => {
  const settings = buildSettings();

  it.each(SCHEDULE_STAGES)("stage=%s → 各 settings 値を返す", (stage) => {
    const v = getStageOffsetDays(stage, settings);
    expect(typeof v).toBe("number");
    expect(v).toBeGreaterThanOrEqual(0);
  });

  it("calculation = 2", () => {
    expect(getStageOffsetDays("calculation", settings)).toBe(2);
  });

  it("sharoshi_check = 3（4 次 follow-up デフォルト）", () => {
    expect(getStageOffsetDays("sharoshi_check", settings)).toBe(3);
  });

  it("visual_double_check = 1（4 次 follow-up デフォルト）", () => {
    expect(getStageOffsetDays("visual_double_check", settings)).toBe(1);
  });

  it("カスタム値に差し替え可", () => {
    const custom = buildSettings({ calculationOffsetDays: 5 });
    expect(getStageOffsetDays("calculation", custom)).toBe(5);
  });
});

// ============================================================
// 2. addBusinessDays / formatYmd
// ============================================================

describe("addBusinessDays", () => {
  it("offset 0 → 同日", () => {
    const base = new Date(2026, 4, 8); // Friday
    const next = addBusinessDays(base, 0);
    expect(formatYmd(next)).toBe(formatYmd(base));
  });

  it("Friday + 1 営業日 = Monday（週末スキップ）", () => {
    const friday = new Date(2026, 4, 8); // Fri 5/8
    const next = addBusinessDays(friday, 1);
    expect(formatYmd(next)).toBe("2026-05-11"); // Mon
  });

  it("Friday + 5 営業日 = 翌週 Friday", () => {
    const friday = new Date(2026, 4, 8); // Fri 5/8
    const next = addBusinessDays(friday, 5);
    expect(formatYmd(next)).toBe("2026-05-15"); // Fri
  });

  it("offset 負数 → 同日返す", () => {
    const base = new Date(2026, 4, 8);
    const r = addBusinessDays(base, -1);
    expect(formatYmd(r)).toBe(formatYmd(base));
  });
});

describe("formatYmd", () => {
  it("ゼロパディング", () => {
    expect(formatYmd(new Date(2026, 0, 1))).toBe("2026-01-01"); // Jan 1
  });

  it("通常日付", () => {
    expect(formatYmd(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

// ============================================================
// 3. generateScheduleForPeriod
// ============================================================

describe("generateScheduleForPeriod", () => {
  it("7 stage 全件返す（順序: calculation → finalization）", () => {
    const r = generateScheduleForPeriod({
      periodEnd: "2026-04-30", // Thursday
      settings: buildSettings(),
    });
    expect(r.length).toBe(7);
    expect(r.map((s) => s.stage)).toEqual([
      "calculation",
      "approval",
      "mfc_import",
      "audit",
      "visual_double_check",
      "sharoshi_check",
      "finalization",
    ]);
  });

  it("各 stage の plannedDate は前 stage より後", () => {
    const r = generateScheduleForPeriod({
      periodEnd: "2026-04-30",
      settings: buildSettings(),
    });
    for (let i = 1; i < r.length; i++) {
      expect(r[i].plannedDate >= r[i - 1].plannedDate).toBe(true);
    }
  });

  it("4 次 follow-up デフォルト累計: 10 営業日（period_end + 2+1+1+1+1+3+1）", () => {
    const r = generateScheduleForPeriod({
      periodEnd: "2026-04-30", // Thursday
      settings: buildSettings(),
    });
    // 5/4-5 (Mon-Tue) は祝日（GW）だが本ロジックは週末スキップのみ
    // 営業日カウント: 04-30(Thu) → +2 = 5/4(Mon)、+1=5/5(Tue)、+1=5/6(Wed)、+1=5/7(Thu)、+1=5/8(Fri)、+3=5/13(Wed)、+1=5/14(Thu)
    // ただしこれは週末スキップのみ、祝日対応は Phase E
    const last = r[r.length - 1];
    expect(last.stage).toBe("finalization");
    expect(last.plannedDate).toBe("2026-05-14");
  });

  it("不正な periodEnd → エラー", () => {
    expect(() =>
      generateScheduleForPeriod({
        periodEnd: "invalid-date",
        settings: buildSettings(),
      }),
    ).toThrow();
  });
});

// ============================================================
// 4. decideSeverity
// ============================================================

describe("decideSeverity", () => {
  const base = { warnAfterHours: 24, criticalAfterHours: 72 };

  it("予定日未到達（hoursOverdue < 0）→ info", () => {
    expect(decideSeverity({ hoursOverdue: -10, ...base })).toBe("info");
  });

  it("hoursOverdue=0（予定日ちょうど）→ info", () => {
    expect(decideSeverity({ hoursOverdue: 0, ...base })).toBe("info");
  });

  it("hoursOverdue=23（warn 直前）→ info", () => {
    expect(decideSeverity({ hoursOverdue: 23, ...base })).toBe("info");
  });

  it("hoursOverdue=24（warn 境界）→ warning", () => {
    expect(decideSeverity({ hoursOverdue: 24, ...base })).toBe("warning");
  });

  it("hoursOverdue=71（critical 直前）→ warning", () => {
    expect(decideSeverity({ hoursOverdue: 71, ...base })).toBe("warning");
  });

  it("hoursOverdue=72（critical 境界）→ critical", () => {
    expect(decideSeverity({ hoursOverdue: 72, ...base })).toBe("critical");
  });

  it("hoursOverdue=200（重大超過）→ critical", () => {
    expect(decideSeverity({ hoursOverdue: 200, ...base })).toBe("critical");
  });
});

// ============================================================
// 5. calculateHoursOverdue
// ============================================================

describe("calculateHoursOverdue", () => {
  it("now が予定日と同じ → 0h", () => {
    const now = new Date(2026, 4, 8); // 5/8 00:00
    expect(calculateHoursOverdue("2026-05-08", now)).toBe(0);
  });

  it("now が予定日より 24h 後 → 24", () => {
    const now = new Date(2026, 4, 9); // 5/9 00:00
    expect(calculateHoursOverdue("2026-05-08", now)).toBe(24);
  });

  it("now が予定日より前 → 負数", () => {
    const now = new Date(2026, 4, 7); // 5/7 00:00
    const h = calculateHoursOverdue("2026-05-08", now);
    expect(h).toBeLessThan(0);
  });

  it("不正な plannedDate → 0", () => {
    expect(calculateHoursOverdue("invalid")).toBe(0);
  });
});

// ============================================================
// 6. decideEscalationLevel
// ============================================================

describe("decideEscalationLevel", () => {
  const base = { escalationAfterDays: 3, fullCompanyNotifyAfterDays: 5 };

  it("daysOverdue=0 → 0（通常）", () => {
    expect(decideEscalationLevel({ daysOverdue: 0, ...base })).toBe(0);
  });

  it("daysOverdue=2.9 → 0（境界 直前）", () => {
    expect(decideEscalationLevel({ daysOverdue: 2.9, ...base })).toBe(0);
  });

  it("daysOverdue=3 → 1（東海林 DM）", () => {
    expect(decideEscalationLevel({ daysOverdue: 3, ...base })).toBe(1);
  });

  it("daysOverdue=4.9 → 1", () => {
    expect(decideEscalationLevel({ daysOverdue: 4.9, ...base })).toBe(1);
  });

  it("daysOverdue=5 → 2（全社員通知）", () => {
    expect(decideEscalationLevel({ daysOverdue: 5, ...base })).toBe(2);
  });

  it("daysOverdue=10 → 2", () => {
    expect(decideEscalationLevel({ daysOverdue: 10, ...base })).toBe(2);
  });

  it("負数（予定日未到達）→ 0", () => {
    expect(decideEscalationLevel({ daysOverdue: -5, ...base })).toBe(0);
  });
});

// ============================================================
// 7. resolveRecipients
// ============================================================

describe("resolveRecipients", () => {
  const base = {
    auditorEmployeeId: "auditor-shoji",
    allEmployeeIds: ["emp-a", "emp-b", "emp-c", "auditor-shoji"],
  };

  it("level 0: 担当者のみ", () => {
    const r = resolveRecipients({
      assignedToEmployeeId: "emp-a",
      assignedToPartnerId: null,
      escalationLevel: 0,
      ...base,
    });
    expect(r.employeeIds).toEqual(["emp-a"]);
    expect(r.partnerId).toBeNull();
  });

  it("level 1: 担当者 + 東海林（重複なし）", () => {
    const r = resolveRecipients({
      assignedToEmployeeId: "emp-a",
      assignedToPartnerId: null,
      escalationLevel: 1,
      ...base,
    });
    expect(r.employeeIds.length).toBe(2);
    expect(r.employeeIds).toContain("emp-a");
    expect(r.employeeIds).toContain("auditor-shoji");
  });

  it("level 1 + 担当者が東海林 → 1 名のみ", () => {
    const r = resolveRecipients({
      assignedToEmployeeId: "auditor-shoji",
      assignedToPartnerId: null,
      escalationLevel: 1,
      ...base,
    });
    expect(r.employeeIds).toEqual(["auditor-shoji"]);
  });

  it("level 2: 全社員（4 名）", () => {
    const r = resolveRecipients({
      assignedToEmployeeId: "emp-a",
      assignedToPartnerId: null,
      escalationLevel: 2,
      ...base,
    });
    expect(r.employeeIds.length).toBe(4);
  });

  it("partner_id は escalation level に関係なく保持（社労士 stage）", () => {
    const r = resolveRecipients({
      assignedToEmployeeId: "auditor-shoji",
      assignedToPartnerId: "partner-sharoshi",
      escalationLevel: 1,
      ...base,
    });
    expect(r.partnerId).toBe("partner-sharoshi");
  });

  it("担当者 null + level 1 → 東海林のみ", () => {
    const r = resolveRecipients({
      assignedToEmployeeId: null,
      assignedToPartnerId: null,
      escalationLevel: 1,
      ...base,
    });
    expect(r.employeeIds).toEqual(["auditor-shoji"]);
  });
});

// ============================================================
// 8. renderReminderMessage
// ============================================================

describe("renderReminderMessage", () => {
  it("calculation × info → assignee 置換", () => {
    const msg = renderReminderMessage({
      stage: "calculation",
      severity: "info",
      plannedDate: "2026-05-12",
      hoursOverdue: -10,
      assigneeName: "上田",
      partnerName: null,
    });
    expect(msg).toContain("2026-05-12");
    expect(msg).toContain("上田");
  });

  it("approval × warning → hours 置換", () => {
    const msg = renderReminderMessage({
      stage: "approval",
      severity: "warning",
      plannedDate: "2026-05-12",
      hoursOverdue: 30,
      assigneeName: "宮永",
      partnerName: null,
    });
    expect(msg).toContain("30h");
  });

  it("visual_double_check × info → 上田向け、時間かかってもよい メッセージ", () => {
    const msg = renderReminderMessage({
      stage: "visual_double_check",
      severity: "info",
      plannedDate: "2026-05-12",
      hoursOverdue: 0,
      assigneeName: "上田",
      partnerName: null,
    });
    expect(msg).toContain("上田");
    expect(msg).toContain("時間かかってもよい");
  });

  it("sharoshi_check × critical → partner_name 置換", () => {
    const msg = renderReminderMessage({
      stage: "sharoshi_check",
      severity: "critical",
      plannedDate: "2026-05-12",
      hoursOverdue: 96,
      assigneeName: "東海林",
      partnerName: "○○社労士事務所",
    });
    expect(msg).toContain("○○社労士事務所");
    expect(msg).toContain("96h");
  });

  it("partner_name null → 「社労士未登録」フォールバック", () => {
    const msg = renderReminderMessage({
      stage: "sharoshi_check",
      severity: "info",
      plannedDate: "2026-05-12",
      hoursOverdue: 0,
      assigneeName: "東海林",
      partnerName: null,
    });
    expect(msg).toContain("社労士未登録");
  });

  it("hoursOverdue 負数 → 0 として表示", () => {
    const msg = renderReminderMessage({
      stage: "approval",
      severity: "info",
      plannedDate: "2026-05-12",
      hoursOverdue: -5,
      assigneeName: "宮永",
      partnerName: null,
    });
    expect(msg).not.toContain("-5");
  });

  it("全 stage × 全 severity = 21 通りのテンプレ存在", () => {
    for (const stage of SCHEDULE_STAGES) {
      const tpl = REMINDER_TEMPLATES[stage];
      expect(tpl.info.length).toBeGreaterThan(0);
      expect(tpl.warning.length).toBeGreaterThan(0);
      expect(tpl.critical.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// 9. decideScheduleStatus
// ============================================================

describe("decideScheduleStatus", () => {
  it("actualDate あり → completed", () => {
    expect(
      decideScheduleStatus({
        plannedDate: "2026-05-08",
        actualDate: "2026-05-08",
        now: new Date(2026, 4, 9),
      }),
    ).toBe("completed");
  });

  it("予定日未到達（now < planned）→ not_started", () => {
    expect(
      decideScheduleStatus({
        plannedDate: "2026-05-12",
        actualDate: null,
        now: new Date(2026, 4, 8),
      }),
    ).toBe("not_started");
  });

  it("予定日当日（hoursOverdue 0-23）→ in_progress", () => {
    const now = new Date(2026, 4, 8, 10, 0, 0); // 5/8 10:00
    expect(
      decideScheduleStatus({
        plannedDate: "2026-05-08",
        actualDate: null,
        now,
      }),
    ).toBe("in_progress");
  });

  it("予定日 + 24h 経過（hoursOverdue >= 24）→ overdue", () => {
    expect(
      decideScheduleStatus({
        plannedDate: "2026-05-08",
        actualDate: null,
        now: new Date(2026, 4, 9, 0, 0, 0), // 5/9 00:00 = +24h
      }),
    ).toBe("overdue");
  });
});

// ============================================================
// 10. STAGE_DEPENDENCIES（spec § 2.1 表整合性）
// ============================================================

describe("STAGE_DEPENDENCIES", () => {
  it("7 stage 順序", () => {
    expect(STAGE_DEPENDENCIES.length).toBe(7);
    expect(STAGE_DEPENDENCIES[0].stage).toBe("calculation");
    expect(STAGE_DEPENDENCIES[6].stage).toBe("finalization");
  });

  it("calculation の起点は period_end", () => {
    expect(STAGE_DEPENDENCIES[0].basedOn).toBe("period_end");
  });

  it("各 stage の起点 = 前 stage", () => {
    for (let i = 1; i < STAGE_DEPENDENCIES.length; i++) {
      expect(STAGE_DEPENDENCIES[i].basedOn).toBe(STAGE_DEPENDENCIES[i - 1].stage);
    }
  });

  it("visual_double_check は audit と sharoshi_check の間（spec § 2.1）", () => {
    const idx = STAGE_DEPENDENCIES.findIndex((d) => d.stage === "visual_double_check");
    expect(idx).toBe(4);
    expect(STAGE_DEPENDENCIES[idx].basedOn).toBe("audit");
    expect(STAGE_DEPENDENCIES[idx + 1].stage).toBe("sharoshi_check");
  });
});
