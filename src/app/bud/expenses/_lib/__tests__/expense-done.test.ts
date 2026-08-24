import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildReexportConfirmation, donePageBounds, donePeriodEnd, donePeriodStart, filterAndSortDoneRows, formatYayoiExportRecord, summarizeDoneRows } from "../expense-done";
import { calculateTaxExcludedAmount } from "../expense-booking-groups";

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
  it("formats missing and recorded Yayoi export history", () => {
    expect(formatYayoiExportRecord({ yayoi_export_count: 0, yayoi_exported_at: null })).toBe("未出力");
    expect(formatYayoiExportRecord({ yayoi_export_count: 2, yayoi_exported_at: "2026-08-23T15:00:00.000Z" })).toBe("2回（最終 2026/08/24）");
  });
  it("confirms only when the selection contains exported rows", () => {
    expect(buildReexportConfirmation([{ yayoi_export_count: 0, yayoi_exported_at: null }])).toBeNull();
    expect(buildReexportConfirmation([
      { yayoi_export_count: 1, yayoi_exported_at: "2026-08-22T15:00:00.000Z" },
      { yayoi_export_count: 0, yayoi_exported_at: null },
      { yayoi_export_count: 2, yayoi_exported_at: "2026-08-23T15:00:00.000Z" },
    ])).toBe("選択した3件のうち2件は出力済みです（最終 2026/08/24）。再出力しますか？");
  });
  it("requires a selected corporation and selected rows and clips long export labels", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/bud/expenses/_components/ExpenseDonePanel.tsx"), "utf8");
    expect(source).toContain('disabled={corpId === "all" || selectedRows.length === 0');
    expect(source).toContain("if (confirmation && !window.confirm(confirmation)) return");
    expect(source).toContain('body: JSON.stringify({ corpId, ids: selectedRows.map((row) => row.id), mode: "reexport" })');
    expect(source).toContain('const exportCell: React.CSSProperties = { ...td, maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis" }');
  });
  it("paginates by 100 and reports the final partial page", () => {
    expect(donePageBounds(0, 12311)).toEqual({ from: 0, to: 99, label: "1〜100 / 12,311件", lastPage: 123 });
    expect(donePageBounds(123, 12311)).toEqual({ from: 12300, to: 12310, label: "12,301〜12,311 / 12,311件", lastPage: 123 });
  });
  it("uses the database aggregate and resets pagination when filters change", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/bud/expenses/_components/ExpenseDonePanel.tsx"), "utf8");
    expect(source).toContain('supabase.rpc("bud_expense_done_summary"');
    expect(source).toContain("query.range(page * DONE_PAGE_SIZE, page * DONE_PAGE_SIZE + DONE_PAGE_SIZE - 1)");
    expect(source.match(/setPage\(0\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(source).toContain("calculateTaxExcludedAmount(taxIncluded)");
    expect(source).toContain("pageBounds.label");
    expect(source).toContain('const pagePosition: React.CSSProperties = { minWidth: 150, textAlign: "center", color: "var(--text-main)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"');
  });
  it("defines an unrestricted database aggregate for all matching rows", () => {
    const migration = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260824000004_bud_expense_done_summary.sql"), "utf8");
    expect(migration).toContain("count(*)::bigint");
    expect(migration).toContain("coalesce(sum(amount), 0)::numeric");
    expect(migration).not.toContain("limit");
    expect(calculateTaxExcludedAmount(47_212_605)).toBe(42_920_550);
  });
});
