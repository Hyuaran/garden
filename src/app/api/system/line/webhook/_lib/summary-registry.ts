import { buildNhkVisitLineDailySummary, buildNhkVisitLineMonthSummary } from "@/app/system/forms/nhk-visit/_lib/nhk-visit-summary";
import { loadNhkVisitRows, monthStart, summaryLoadStart } from "@/app/system/forms/nhk-visit/_lib/nhk-visit-summary.server";
import { todayJst } from "./line-keyword";

export type LineSummaryKind = "day" | "month";

export type LineSummaryDefinition = {
  /** The keyword users put at the start of a LINE summary command. */
  keyword: string;
  /** Display name used in command lists. */
  name: string;
  /** Build a summary for a single target date. */
  buildDay: (date: string) => Promise<string>;
  /** Build the current month summary. */
  buildMonth: (month: string) => Promise<string>;
};

export const LINE_SUMMARIES: LineSummaryDefinition[] = [{
  keyword: "NHK",
  name: "NHK訪問業務",
  buildDay: async (date: string) => {
    const rows = await loadNhkVisitRows(summaryLoadStart(date), date);
    return buildNhkVisitLineDailySummary(rows, date);
  },
  buildMonth: async (month: string) => {
    const rows = await loadNhkVisitRows(monthStart(month), todayJst());
    return buildNhkVisitLineMonthSummary(rows, month);
  },
}];

export function findLineSummaryDefinition(keyword: string) {
  return LINE_SUMMARIES.find((summary) => summary.keyword.toLocaleLowerCase() === keyword.toLocaleLowerCase()) ?? null;
}
