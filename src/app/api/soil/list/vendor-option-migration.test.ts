import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(process.cwd(), "supabase", "migrations", "20260917000008_soil_list_vendor_option.sql");
const sql = readFileSync(migrationPath, "utf8");

describe("vendor option migration", () => {
  it("adds latest purchase vendor to refreshed option columns", () => {
    expect(sql).toContain("create or replace function public.soil_list_refresh_options()");
    expect(sql).toContain("'最新購入先'");
    expect(sql).toContain("public.soil_list_option");
  });

  it("adds a btree index for latest purchase vendor filtering", () => {
    expect(sql).toContain("create index if not exists soil_list_phone_latest_purchase_vendor_idx");
    expect(sql).toContain('on public.soil_list_phone ("最新購入先")');
  });
});
