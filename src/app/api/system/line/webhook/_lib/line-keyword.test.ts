import { describe, expect, it } from "vitest";
import { parseLineSummaryKeyword } from "./line-keyword";

describe("parseLineSummaryKeyword", () => {
  it("matches fixed keywords", () => {
    expect(parseLineSummaryKeyword("集計")).toEqual({ kind: "day", dateOffset: 0 });
    expect(parseLineSummaryKeyword("昨日の集計")).toEqual({ kind: "day", dateOffset: -1 });
    expect(parseLineSummaryKeyword("今月の集計")).toEqual({ kind: "month" });
  });

  it("matches three date formats", () => {
    expect(parseLineSummaryKeyword("20260924集計")).toEqual({ kind: "date", date: "2026-09-24" });
    expect(parseLineSummaryKeyword("2026-09-24集計")).toEqual({ kind: "date", date: "2026-09-24" });
    expect(parseLineSummaryKeyword("2026/09/24集計")).toEqual({ kind: "date", date: "2026-09-24" });
  });

  it("returns null for unrelated or invalid words", () => {
    expect(parseLineSummaryKeyword("こんにちは")).toBeNull();
    expect(parseLineSummaryKeyword("2026-13-40集計")).toBeNull();
  });
});
