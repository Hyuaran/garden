import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("expense Yayoi export history migration", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260824000002_bud_expense_yayoi_export_history.sql"), "utf8");

  it("adds a zero-based count and records every export", () => {
    expect(source).toContain("yayoi_exported_at timestamptz");
    expect(source).toContain("yayoi_export_count integer not null default 0");
    expect(source.match(/yayoi_export_count = coalesce\(yayoi_export_count, 0\) \+ 1/g)).toHaveLength(2);
  });

  it("completes an initial export but preserves journalized status on reexport", () => {
    const reexportBranch = source.slice(source.indexOf("if p_reexport then"), source.indexOf("else"));
    expect(reexportBranch).toContain("status = 'journalized'");
    expect(reexportBranch).not.toContain("set status");
    expect(source.slice(source.indexOf("else"))).toContain("set status = 'journalized'");
    expect(source.slice(source.indexOf("else"))).toContain("status = 'journalize_pending'");
  });
});
