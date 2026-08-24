import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("expense Yayoi export booking constraints", () => {
  it("requires booking info and filters by booking corporation", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/api/bud/expense-booking/export/route.ts"), "utf8");
    expect(source).toContain("!row.booking_date || !row.booking_corp_id");
    expect(source).toContain("row.booking_corp_id !== corpId");
    expect(source).not.toContain("getEffectiveCorpId(row, employees, companyToCorp) !== corpId");
  });

  it("exports only completed rows and rejects the removed initial mode", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/api/bud/expense-booking/export/route.ts"), "utf8");
    expect(source.match(/exportYayoiCsv\(/g)).toHaveLength(1);
    expect(source).toContain('body.mode !== "reexport"');
    expect(source).toContain('.eq("status", "journalized")');
    expect(source).toContain('supabase.rpc("bud_record_expense_yayoi_export"');
    expect(source).not.toContain("journalize_pending");
    expect(source).not.toContain("p_reexport");
  });
});
