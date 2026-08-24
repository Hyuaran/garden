import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("expense Yayoi export history migration", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260824000005_bud_expense_booking_completes.sql"), "utf8");

  it("adds a zero-based count and records every export", () => {
    expect(source).toContain("yayoi_exported_at = now()");
    expect(source.match(/yayoi_export_count = coalesce\(yayoi_export_count, 0\) \+ 1/g)).toHaveLength(1);
  });

  it("removes the initial-export function and records only completed rows", () => {
    expect(source).toContain("drop function if exists public.bud_record_expense_yayoi_export(uuid[], boolean)");
    const exportFunction = source.slice(source.indexOf("create function public.bud_record_expense_yayoi_export"));
    expect(exportFunction).toContain("status = 'journalized'");
    expect(exportFunction).not.toContain("journalize_pending");
    expect(exportFunction).not.toContain("set status");
  });
});
