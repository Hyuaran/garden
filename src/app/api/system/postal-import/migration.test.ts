import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("postal dataset migration", () => {
  it("keeps the old version active until a complete replacement is activated", () => {
    const sql = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260825000001_system_postal_addresses.sql"), "utf8");
    expect(sql).toContain("where active");
    expect(sql).toContain("postal row count mismatch");
    expect(sql).toContain("update system_postal_datasets set active = false where active");
    expect(sql).toContain("update system_postal_datasets set active = true");
  });
});
