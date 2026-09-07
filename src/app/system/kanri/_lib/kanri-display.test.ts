import { describe, expect, it } from "vitest";
import {
  buildKanriDisplayPayload,
  formatKanriDisplayValue,
  kanriDisplayTitle,
} from "./kanri-display";
import type { AporanSheetGrid } from "./calc/aporan-sheet";
import type { KanriSheetGrid } from "./calc/kanri-sheet";

describe("kanri display formatters", () => {
  it("formats values like the monitor sheet", () => {
    expect(formatKanriDisplayValue(25, "points")).toBe("25.0P");
    expect(formatKanriDisplayValue(0.542, "rate")).toBe("54.2%");
    expect(formatKanriDisplayValue(null, "points")).toBe("—");
  });

  it("builds a title with workday numbers", () => {
    expect(kanriDisplayTitle("2026-09-06", 5, 26)).toBe("9月6日(日)時点の成績　5/26稼働");
  });

  it("omits workday numbers when the target day has no number", () => {
    expect(kanriDisplayTitle("2026-09-06", null, 26)).toBe("9月6日(日)時点の成績");
  });

  it("builds the 8 row by 4 column display payload", () => {
    const aporanGrid = {
      yearMonth: "2026-09",
      targetDate: "2026-09-06",
      teamOrder: ["all", "miyanaga", "koizumi", "ishihara", "newcomer"],
      ranking: [],
      cellValues: {},
      teams: {
        all: { key: "all", label: "テレマ全体", efficiency: 0.05, actualPoints: 25, targetPoints: 240, currentRequiredPoints: 46.1, workHours: 473, landingHours: 2691.5, landingPoints: 130.1, achievementRate: 0.542 },
        miyanaga: { key: "miyanaga", label: "宮永チーム", efficiency: 0.05, actualPoints: 7.1, targetPoints: 80, currentRequiredPoints: 15.3, workHours: 139, landingHours: 851, landingPoints: 37.1, achievementRate: 0.464 },
        koizumi: { key: "koizumi", label: "小泉チーム", efficiency: 0.08, actualPoints: 11, targetPoints: 80, currentRequiredPoints: 15.3, workHours: 146, landingHours: 893.5, landingPoints: 57.5, achievementRate: 0.719 },
        ishihara: { key: "ishihara", label: "石原チーム", efficiency: 0.04, actualPoints: 6.9, targetPoints: 80, currentRequiredPoints: 15.3, workHours: 188, landingHours: 947, landingPoints: 36, achievementRate: 0.451 },
        newcomer: { key: "newcomer", label: "新人チーム", efficiency: null, actualPoints: 0, targetPoints: 0, currentRequiredPoints: 0, workHours: 0, landingHours: 0, landingPoints: null, achievementRate: null },
      },
    } satisfies AporanSheetGrid;
    const kanriGrid = {
      days: [
        { date: "2026-09-01", day: 1 },
        { date: "2026-09-02", day: 2 },
        { date: "2026-09-03", day: 3 },
        { date: "2026-09-04", day: 4 },
        { date: "2026-09-06", day: 5 },
      ],
    } as KanriSheetGrid;

    const payload = buildKanriDisplayPayload({ aporanGrid, kanriGrid, calculatedAt: "2026-09-07T09:05:00Z" });

    expect(payload.title).toBe("9月6日(日)時点の成績　5/5稼働");
    expect(payload.columns.map((column) => column.label)).toEqual(["テレマ全体", "宮永チーム", "小泉チーム", "石原チーム"]);
    expect(payload.rows).toHaveLength(8);
    expect(payload.rows[1].values).toEqual(["25.0P", "7.1P", "11.0P", "6.9P"]);
    expect(payload.rows.filter((row) => row.emphasis).map((row) => row.label)).toEqual(["実績P", "着地予想P", "達成率"]);
  });
});
