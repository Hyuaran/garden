import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("expense ledger export route is read-only", () => {
  it("excludes soft-deleted rows and never updates expense status", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/api/bud/expense-booking/ledger-export/route.ts"), "utf8");
    expect(source).toContain('.is("deleted_at", null)');
    expect(source).not.toMatch(/\.update\s*\(/);
    expect(source).not.toContain('status: "journalized"');
  });
});
