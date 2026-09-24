import { describe, expect, it } from "vitest";
import { buildNhkVisitReportMessage, calculateNhkVisitTotals } from "./nhk-visit";

const base = {
  visitDate: "2026-09-24",
  startTime: "09:30",
  endTime: "18:00",
  destination: "NHK奈良" as const,
  transportFee: "あり" as const,
};

describe("nhk visit helpers", () => {
  it("builds the exact message when all counts are zero", () => {
    expect(buildNhkVisitReportMessage({
      ...base,
      newGround: 0,
      newSatellite: 0,
      addressGround: 0,
      addressSatellite: 0,
      bankCredit: 0,
    })).toBe([
      "【日付】2026/09/24",
      "【時間】09:30〜18:00",
      "【派遣先】NHK奈良",
      "【業務】対面アプローチ",
      "【成約件数】",
      "　■新規　0件（地上0件、衛星0件）",
      "　■住所変更　0件（地上0件、衛星0件）",
      "　■口座・クレ　0件",
      "【交通費】あり",
    ].join("\n"));
  });

  it("builds the exact message with ground-only counts", () => {
    expect(buildNhkVisitReportMessage({
      ...base,
      newGround: 2,
      newSatellite: 0,
      addressGround: 1,
      addressSatellite: 0,
      bankCredit: 0,
      transportFee: "なし",
    })).toBe([
      "【日付】2026/09/24",
      "【時間】09:30〜18:00",
      "【派遣先】NHK奈良",
      "【業務】対面アプローチ",
      "【成約件数】",
      "　■新規　2件（地上2件、衛星0件）",
      "　■住所変更　1件（地上1件、衛星0件）",
      "　■口座・クレ　0件",
      "【交通費】なし",
    ].join("\n"));
  });

  it("builds the exact message with every count", () => {
    expect(buildNhkVisitReportMessage({
      ...base,
      newGround: 1,
      newSatellite: 1,
      addressGround: 2,
      addressSatellite: 3,
      bankCredit: 4,
    })).toBe([
      "【日付】2026/09/24",
      "【時間】09:30〜18:00",
      "【派遣先】NHK奈良",
      "【業務】対面アプローチ",
      "【成約件数】",
      "　■新規　2件（地上1件、衛星1件）",
      "　■住所変更　5件（地上2件、衛星3件）",
      "　■口座・クレ　4件",
      "【交通費】あり",
    ].join("\n"));
  });

  it("calculates totals used by display and kintone", () => {
    expect(calculateNhkVisitTotals({
      newGround: 1,
      newSatellite: 2,
      addressGround: 3,
      addressSatellite: 4,
      bankCredit: 5,
    })).toEqual({ newTotal: 3, addressTotal: 7, contractTotal: 15 });
  });
});
