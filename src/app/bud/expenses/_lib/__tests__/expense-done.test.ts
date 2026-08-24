import { describe, expect, it } from "vitest";
import { donePeriodEnd, donePeriodStart, filterAndSortDoneRows, summarizeDoneRows } from "../expense-done";

const rows = [
  { id: "old", status: "journalized", deleted_at: null, booking_date: "2026-07-31", booking_corp_id: "a", amount: 1100 },
  { id: "new", status: "journalized", deleted_at: null, booking_date: "2026-08-20", booking_corp_id: "a", amount: 2200 },
  { id: "other", status: "journalized", deleted_at: null, booking_date: "2026-08-10", booking_corp_id: "b", amount: 3300 },
  { id: "pending", status: "journalize_pending", deleted_at: null, booking_date: "2026-08-21", booking_corp_id: "a", amount: 4400 },
  { id: "deleted", status: "journalized", deleted_at: "2026-08-22", booking_date: "2026-08-22", booking_corp_id: "a", amount: 5500 },
];

describe("expense done tab", () => {
  it("defaults to the current month", () => {
    expect(donePeriodStart("month", new Date(2026, 7, 24))).toBe("2026-08-01");
    expect(donePeriodEnd("month", new Date(2026, 7, 24))).toBe("2026-09-01");
  });
  it("filters status, deletion, period and booking corporation and sorts newest first", () => {
    expect(filterAndSortDoneRows(rows, "a", "2026-08-01").map((row) => row.id)).toEqual(["new"]);
    expect(filterAndSortDoneRows(rows, "all", null).map((row) => row.id)).toEqual(["new", "other", "old"]);
  });
  it("summarizes displayed rows with tax included and excluded", () => {
    expect(summarizeDoneRows(rows.slice(0, 2))).toEqual({ count: 2, taxIncluded: 3300, taxExcluded: 3000 });
    expect(summarizeDoneRows([])).toEqual({ count: 0, taxIncluded: 0, taxExcluded: 0 });
  });
});
