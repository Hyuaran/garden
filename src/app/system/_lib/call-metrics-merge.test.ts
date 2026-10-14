import { describe, expect, it } from "vitest";

import type { CallMetricsResponse, EmployeeCallMetricRow } from "./call-metrics";
import { isInnoveraStopped, mergeCallMetrics, resolveEmployeeIdForCallMetrics, type RootEmployeeForCallMetrics } from "./call-metrics-merge";

// 仕様書 v1.7 §13（2026-10-13）の内線別の表
const ROOT: RootEmployeeForCallMetrics[] = [
  { employee_id: "EMP-1523", name: "石原　孝志朗", innovera_extension: "2003", innovera_mobile_extension: "1003", is_active: true, deleted_at: null },
  { employee_id: "EMP-1384", name: "石原　孝志朗", innovera_extension: null, innovera_mobile_extension: null, is_active: false, deleted_at: null }, // 退職の同名行
  { employee_id: "EMP-1326", name: "小泉　翔", innovera_extension: "2011", innovera_mobile_extension: "1006", is_active: true, deleted_at: null },
  { employee_id: "EMP-1490", name: "藤木　誠希", innovera_extension: "2006", innovera_mobile_extension: null, is_active: true, deleted_at: null },
  { employee_id: "EMP-1394", name: "南薗　優樹", innovera_extension: "2034", innovera_mobile_extension: null, is_active: true, deleted_at: null },
  { employee_id: "EMP-1165", name: "宮永　ひかり", innovera_extension: "2005", innovera_mobile_extension: "1005", is_active: true, deleted_at: null },
  { employee_id: "EMP-1562", name: "大塚　響", innovera_extension: null, innovera_mobile_extension: null, is_active: true, deleted_at: null }, // 内線の登録なし
  { employee_id: "EMP-2010", name: "毛利　祐星", filemaker_employee_name: "毛利", innovera_extension: "2010", innovera_mobile_extension: null, is_active: true, deleted_at: null },
];

const INNOVERA = {
  has_rows: true,
  last_sync_at: "2026-10-14T14:45:18.637+00:00",
  employee_metrics: [
    { employee_id: "EMP-1523", talk_seconds_other: 9383, lp_answered: 8, lp_outbound: 27, lp_talk_seconds: 7172 },
    { employee_id: "EMP-1326", talk_seconds_other: 5452, lp_answered: 6, lp_outbound: 20, lp_talk_seconds: 9267 },
    { employee_id: "EMP-1490", talk_seconds_other: 9085, lp_answered: 6, lp_outbound: 14, lp_talk_seconds: 4899 },
    { employee_id: "EMP-1394", talk_seconds_other: 2668, lp_answered: 8, lp_outbound: 13, lp_talk_seconds: 4675 },
    { employee_id: "EMP-1165", talk_seconds_other: 3208, lp_answered: 0, lp_outbound: 13, lp_talk_seconds: 395 },
    { employee_id: "EMP-2010", talk_seconds_other: 13805, lp_answered: 0, lp_outbound: 0, lp_talk_seconds: 0 },
  ],
  unassigned: [
    { extension: "2043", talk_seconds_other: 9998, lp_answered: 0, lp_outbound: 0, lp_talk_seconds: 0 },
    { extension: "2099", talk_seconds_other: 0, lp_answered: 1, lp_outbound: 2, lp_talk_seconds: 60 },
  ],
  circuit_metrics: [
    { circuit_id: 164, inbound: 25, answered: 14, missed: 11, voicemail: 0, outbound: 48, outbound_answered: 39, talk_seconds: 14498 },
    { circuit_id: 165, inbound: 1, answered: 0, missed: 1, voicemail: 0, outbound: 0, outbound_answered: 0, talk_seconds: 0 },
    { circuit_id: 166, inbound: 21, answered: 14, missed: 7, voicemail: 2, outbound: 39, outbound_answered: 32, talk_seconds: 11910 },
  ],
};

const LP_SCOPE = [
  { bizCode: "hikari-pro", bizName: "ヒカリのプロ", customerApp: 226, circuitIds: [164, 165], recordOrder: 1 },
  { bizCode: "denki-uketsuke", bizName: "電気開始受付センター", customerApp: 235, circuitIds: [166, 133], recordOrder: 2 },
];

function fmRow(employeeName: string, callCount: number): EmployeeCallMetricRow {
  return {
    employeeName,
    callCount,
    effectiveCount: 0,
    effectiveRate: 0,
    tossCount: 0,
    orderCount: 0,
    acquiredCount: 0,
    callOrderRate: 0,
    callAcquiredRate: 0,
    prospectCount: 0,
    absentCount: 0,
    awayCount: 0,
    invalidCount: 0,
    workSeconds: 0,
  };
}

function filemaker(rows: EmployeeCallMetricRow[]): CallMetricsResponse {
  return { from: "2026-10-13", to: "2026-10-13", listName: null, employeeName: null, metrics: [], employeeMetrics: rows, lastImportedAt: null };
}

const NOW = new Date("2026-10-14T14:50:00Z");

function merge(rows: EmployeeCallMetricRow[], overrides: Partial<Parameters<typeof mergeCallMetrics>[0]> = {}) {
  return mergeCallMetrics({
    filemaker: filemaker(rows),
    innovera: INNOVERA,
    lpScope: LP_SCOPE,
    lpApplicationCountsByBiz: new Map([
      ["hikari-pro", new Map([["石原孝志朗", 2], ["担当者未設定", 1]])],
      ["denki-uketsuke", new Map([["藤木誠希", 3]])],
    ]),
    rootEmployees: ROOT,
    now: NOW,
    ...overrides,
  });
}

const byName = (result: CallMetricsResponse, name: string) => result.employeeMetrics.find((row) => row.employeeName === name)!;

describe("mergeCallMetrics（3 系統の合流）", () => {
  it("§13 の内線別の値が FileMaker の行に付く（同名の退職行があっても在籍の行で引く）", () => {
    const result = merge([fmRow("石原　孝志朗", 42), fmRow("小泉　翔", 60), fmRow("藤木　誠希", 143), fmRow("南薗　優樹", 93), fmRow("宮永　ひかり", 6)]);
    expect(byName(result, "石原　孝志朗")).toMatchObject({ callCount: 42, talkSecondsOther: 9383, lpAnswered: 8, lpOutbound: 27, lpTalkSeconds: 7172, lpApplications: 2 });
    expect(byName(result, "小泉　翔")).toMatchObject({ lpAnswered: 6, lpOutbound: 20, lpTalkSeconds: 9267, lpApplications: 0 });
    expect(byName(result, "藤木　誠希")).toMatchObject({ lpAnswered: 6, lpOutbound: 14, lpTalkSeconds: 4899, talkSecondsOther: 9085, lpApplications: 3 });
    expect(byName(result, "南薗　優樹")).toMatchObject({ lpAnswered: 8, lpOutbound: 13, lpTalkSeconds: 4675, talkSecondsOther: 2668 });
    expect(byName(result, "宮永　ひかり")).toMatchObject({ lpAnswered: 0, lpOutbound: 13, lpTalkSeconds: 395, talkSecondsOther: 3208 });
  });

  it("FileMaker 社員名（姓だけ）は Root の filemaker_employee_name で引く", () => {
    const result = merge([fmRow("毛利", 82)]);
    expect(byName(result, "毛利")).toMatchObject({ talkSecondsOther: 13805, lpAnswered: 0, lpOutbound: 0, lpTalkSeconds: 0 });
  });

  it("「-」と 0 の区別：内線の登録が無い人は null、登録はあるが通話が無い人は 0", () => {
    const result = merge([fmRow("大塚　響", 280), fmRow("田中　実花", 168)], {
      rootEmployees: [...ROOT, { employee_id: "EMP-0168", name: "田中　実花", innovera_extension: "2041", is_active: true, deleted_at: null }],
    });
    expect(byName(result, "大塚　響")).toMatchObject({ talkSecondsOther: null, lpAnswered: null, lpOutbound: null, lpTalkSeconds: null, lpApplications: 0 });
    expect(byName(result, "田中　実花")).toMatchObject({ talkSecondsOther: 0, lpAnswered: 0, lpOutbound: 0, lpTalkSeconds: 0 });
  });

  it("期間に INNOVERA の行が 1 件も無いときは 4 列とも null（LP申込みは kintone から出す）", () => {
    const result = merge([fmRow("石原　孝志朗", 42)], { innovera: { ...INNOVERA, has_rows: false, employee_metrics: [], unassigned: [], circuit_metrics: [] } });
    expect(byName(result, "石原　孝志朗")).toMatchObject({ talkSecondsOther: null, lpAnswered: null, lpOutbound: null, lpTalkSeconds: null, lpApplications: 2 });
    expect(result.innovera?.hasRows).toBe(false);
    expect(result.lp?.businesses[0]).toMatchObject({ inbound: null, outbound: null, applications: 3 });
    expect(result.employeeMetrics.some((row) => row.employeeName.startsWith("（内線未登録）"))).toBe(false);
  });

  it("FileMaker に無い Root 従業員は LP の数字が 1 以上のときだけ行を出す", () => {
    const result = merge([fmRow("石原　孝志朗", 42)], {
      lpApplicationCountsByBiz: new Map([["denki-uketsuke", new Map([["藤木誠希", 3], ["宮永ひかり", 0]])]]),
    });
    const names = result.employeeMetrics.map((row) => row.employeeName);
    expect(names).toContain("藤木　誠希");
    expect(byName(result, "藤木　誠希")).toMatchObject({ callCount: 0, lpApplications: 3, lpOutbound: 14 });
    expect(names).not.toContain("宮永　ひかり");
  });

  it("「（内線未登録）n席」は LP の数字が 1 以上の席だけを数え、末尾に出る", () => {
    const result = merge([fmRow("石原　孝志朗", 42)]);
    const last = result.employeeMetrics.at(-1)!;
    expect(last.employeeName).toBe("（内線未登録）2席");
    expect(last).toMatchObject({ lpAnswered: 1, lpOutbound: 2, lpTalkSeconds: 60, talkSecondsOther: 9998, lpApplications: null });
    expect(last.unregisteredExtensionDetails).toEqual(["2043", "2099"]);
    expect(result.lp?.unregisteredExtensionSummary).toBe("（内線未登録）：2043、2099");
  });

  it("事業別の小計と合計（§13 の回線別の表）", () => {
    const result = merge([fmRow("石原　孝志朗", 42)]);
    expect(result.lp?.businesses).toEqual([
      expect.objectContaining({ bizName: "ヒカリのプロ", inbound: 26, answered: 14, missed: 12, voicemail: 0, outbound: 48, outboundAnswered: 39, talkSeconds: 14498, applications: 3, unassignedApplications: 1 }),
      expect.objectContaining({ bizName: "電気開始受付センター", inbound: 21, answered: 14, missed: 7, voicemail: 2, outbound: 39, outboundAnswered: 32, talkSeconds: 11910, applications: 3, unassignedApplications: 0 }),
    ]);
    expect(result.lp?.totals).toMatchObject({ inbound: 47, answered: 28, missed: 19, voicemail: 2, outbound: 87, outboundAnswered: 71, talkSeconds: 26408, applications: 6 });
    expect(result.innovera).toEqual({ lastSyncAt: "2026-10-14T14:45:18.637+00:00", stopped: false, hasRows: true });
  });
});

describe("resolveEmployeeIdForCallMetrics（従業員名で絞るときの解決）", () => {
  it("Root の氏名 → filemaker_employee_name の順。同名は在籍の行を優先", () => {
    expect(resolveEmployeeIdForCallMetrics("石原 孝志朗", ROOT)).toBe("EMP-1523");
    expect(resolveEmployeeIdForCallMetrics("毛利", ROOT)).toBe("EMP-2010");
    expect(resolveEmployeeIdForCallMetrics("該当なし", ROOT)).toBeNull();
  });

  it("退職の行しか無い人はその行で引く", () => {
    expect(resolveEmployeeIdForCallMetrics("石原　孝志朗", [ROOT[1]])).toBe("EMP-1384");
  });
});

describe("isInnoveraStopped", () => {
  it("最後の取込が 20 分以上前なら停止中", () => {
    expect(isInnoveraStopped("2026-10-14T14:30:00Z", new Date("2026-10-14T14:50:00Z"))).toBe(true);
    expect(isInnoveraStopped("2026-10-14T14:31:00Z", new Date("2026-10-14T14:50:00Z"))).toBe(false);
    expect(isInnoveraStopped(null, NOW)).toBe(true);
  });
});
