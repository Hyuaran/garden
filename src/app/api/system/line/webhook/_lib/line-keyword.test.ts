import { describe, expect, it } from "vitest";
import { parseLineSummaryKeyword } from "./line-keyword";

describe("parseLineSummaryKeyword", () => {
  it("matches fixed keywords", () => {
    expect(parseLineSummaryKeyword("NHK集計")).toEqual({ kind: "day", summaryKeyword: "NHK", dateOffset: 0 });
    expect(parseLineSummaryKeyword("nhk集計")).toEqual({ kind: "day", summaryKeyword: "NHK", dateOffset: 0 });
    expect(parseLineSummaryKeyword("NHK集計昨日")).toEqual({ kind: "day", summaryKeyword: "NHK", dateOffset: -1 });
    expect(parseLineSummaryKeyword("NHK今月")).toEqual({ kind: "month", summaryKeyword: "NHK" });
  });

  it("matches three date formats", () => {
    expect(parseLineSummaryKeyword("NHK集計20260924")).toEqual({ kind: "date", summaryKeyword: "NHK", date: "2026-09-24" });
    expect(parseLineSummaryKeyword("NHK集計2026-09-24")).toEqual({ kind: "date", summaryKeyword: "NHK", date: "2026-09-24" });
    expect(parseLineSummaryKeyword("NHK集計2026/09/24")).toEqual({ kind: "date", summaryKeyword: "NHK", date: "2026-09-24" });
  });

  it("matches the keyword list command", () => {
    expect(parseLineSummaryKeyword("合言葉")).toEqual({ kind: "list" });
  });

  it("returns null for unrelated or invalid words", () => {
    expect(parseLineSummaryKeyword("こんにちは")).toBeNull();
    expect(parseLineSummaryKeyword("集計")).toBeNull();
    expect(parseLineSummaryKeyword("20260924集計")).toBeNull();
    expect(parseLineSummaryKeyword("昨日の集計")).toBeNull();
    expect(parseLineSummaryKeyword("今月の集計")).toBeNull();
    expect(parseLineSummaryKeyword("NHK集計2026-13-40")).toBeNull();
  });

  it("does not match a summary keyword that is not enabled", () => {
    expect(parseLineSummaryKeyword("NHK集計", ["SHUKKIN"])).toBeNull();
  });

  // 空白（半角・全角）が入っても同じ扱いにする（2026-09-24 Claude 確認）
  it("accepts a space between the business name and the date", () => {
    expect(parseLineSummaryKeyword("NHK集計 昨日")).toEqual({ kind: "day", summaryKeyword: "NHK", dateOffset: -1 });
    expect(parseLineSummaryKeyword("NHK集計　昨日")).toEqual({ kind: "day", summaryKeyword: "NHK", dateOffset: -1 });
    expect(parseLineSummaryKeyword("NHK集計 20260924")).toEqual({ kind: "date", summaryKeyword: "NHK", date: "2026-09-24" });
    expect(parseLineSummaryKeyword("NHK集計　2026/09/24")).toEqual({ kind: "date", summaryKeyword: "NHK", date: "2026-09-24" });
    expect(parseLineSummaryKeyword("NHK 今月")).toEqual({ kind: "month", summaryKeyword: "NHK" });
  });
});
