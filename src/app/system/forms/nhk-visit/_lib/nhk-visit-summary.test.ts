import { describe, expect, it } from "vitest";
import {
  analyze,
  buildNhkVisitChatworkSummary,
  buildNhkVisitLineDailySummary,
  summarizeDay,
  summarizeMonth,
  type NhkVisitSummaryRow,
} from "./nhk-visit-summary";

const row = (overrides: Partial<NhkVisitSummaryRow>): NhkVisitSummaryRow => ({
  visit_date: "2026-09-24",
  start_time: "09:30",
  end_time: "18:00",
  destination: "NHK奈良",
  new_ground: 0,
  new_satellite: 0,
  address_ground: 0,
  address_satellite: 0,
  bank_credit: 0,
  employee_number: "E001",
  employee_name: "山田 太郎",
  ...overrides,
});

describe("nhk visit summary", () => {
  it("summarizes an empty day without fake person rows", () => {
    const summary = summarizeDay([row({ visit_date: "2026-09-23", new_ground: 1 })], "2026-09-24");
    expect(summary.reportPeople).toBe(0);
    expect(summary.people).toEqual([]);
    expect(summary.totals.contractTotal).toBe(0);
    expect(buildNhkVisitChatworkSummary([], "2026-09-24")).toContain("本日の報告はまだありません");
  });

  it("summarizes one person with all count buckets", () => {
    const summary = summarizeDay([row({ new_ground: 1, new_satellite: 1, address_ground: 2, bank_credit: 1 })], "2026-09-24");
    expect(summary.reportPeople).toBe(1);
    expect(summary.totals).toMatchObject({ newTotal: 2, addressTotal: 2, bankCredit: 1, contractTotal: 5 });
    expect(summary.durationHours).toBe(8.5);
  });

  it("summarizes multiple people and adds two reports from the same person", () => {
    const rows = [
      row({ new_ground: 1 }),
      row({ start_time: "18:30", end_time: "19:30", bank_credit: 1 }),
      row({ employee_number: "E002", employee_name: "田中 花子", destination: "NHK京都", address_ground: 2 }),
    ];
    const summary = summarizeDay(rows, "2026-09-24");
    expect(summary.reportPeople).toBe(2);
    expect(summary.people.find((person) => person.employeeName === "山田 太郎")).toMatchObject({ startTime: "09:30", endTime: "19:30", contractTotal: 2 });
    expect(summary.totals.contractTotal).toBe(4);
  });

  it("keeps month totals within the requested month", () => {
    const summary = summarizeMonth([
      row({ visit_date: "2026-08-31", new_ground: 10 }),
      row({ visit_date: "2026-09-01", new_ground: 1 }),
      row({ visit_date: "2026-09-24", bank_credit: 2 }),
    ], "2026-09");
    expect(summary.total).toBe(3);
    expect(summary.reportDays).toBe(2);
  });

  it("does not break analysis when previous data or working hours are zero", () => {
    const result = analyze([row({ start_time: "09:00", end_time: "09:00", new_ground: 1 })], "2026-09-01");
    expect(result.previousDayTotal).toBe(0);
    expect(result.previousWeekTotal).toBe(0);
    expect(result.dailyAverage).toBe(1);
    expect(result.hourlyRate).toBeNull();
  });

  it("builds Chatwork body in the requested shape", () => {
    const body = buildNhkVisitChatworkSummary([
      row({ new_ground: 1, new_satellite: 1, bank_credit: 1 }),
      row({ employee_number: "E002", employee_name: "田中 花子", destination: "NHK京都", start_time: "10:00", end_time: "18:00", address_ground: 2 }),
      row({ visit_date: "2026-09-23", new_ground: 4 }),
      row({ visit_date: "2026-09-17", new_ground: 5 }),
    ], "2026-09-24");
    expect(body).toContain("[info][title]NHK訪問業務 集計（2026/09/24 木）[/title]");
    expect(body).toContain("■ 本日の報告　2 人");
    expect(body).toContain("山田 太郎　NHK奈良　09:30-18:00");
    expect(body).toContain("新規 2（地上1・衛星1）／住所変更 0／口座・クレ 1　＝ 3 件");
    expect(body).toContain("本日の合計　新規 2・住所変更 2・口座クレ 1　＝ 5 件");
    expect(body).toContain("[/info]");
  });

  it("builds short LINE body", () => {
    expect(buildNhkVisitLineDailySummary([row({ new_ground: 2, bank_credit: 1 })], "2026-09-24")).toContain("山田 太郎　NHK奈良　新規2・住所0・口座1＝3件");
  });
});
