import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("expense ledger export route is read-only", () => {
  it("excludes soft-deleted rows and never updates expense status", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/api/bud/expense-booking/ledger-export/route.ts"), "utf8");
    expect(source).toContain('.is("deleted_at", null)');
    expect(source).not.toMatch(/\.update\s*\(/);
    expect(source).not.toContain('status: "journalized"');
    expect(source).not.toContain("bud_record_expense_yayoi_export");
    expect(source).not.toContain("yayoi_export_count");
  });

  it("supports a read-only done scope with period and booking-corporation filters", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/api/bud/expense-booking/ledger-export/route.ts"), "utf8");
    expect(source).toContain('scope === "done" ? "journalized" : "journalize_pending"');
    expect(source).toContain('.gte("booking_date", body.start)');
    expect(source).toContain('.lt("booking_date", body.end)');
    expect(source).toContain('row.booking_corp_id === corpId');
    expect(source).not.toMatch(/\.update\s*\(/);
    expect(source).toContain("readAllSupabasePages");
    expect(source).toContain(".range(from, to)");
  });
});
