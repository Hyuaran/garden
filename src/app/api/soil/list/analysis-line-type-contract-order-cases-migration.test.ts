import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(process.cwd(), "supabase", "migrations", "20260916000001_soil_list_analysis_line_type_contract_order_cases.sql");
const sql = readFileSync(migrationPath, "utf8");

describe("analysis line type / contract year / order cases migration", () => {
  it("adds order case columns to analysis cells and phone ledger", () => {
    expect(sql).toContain("add column if not exists order_case_count integer not null default 0");
    expect(sql).toContain('add column if not exists "受注案件数" integer not null default 0');
    expect(sql).toContain('count(distinct o."顧客一覧レコード番号")::integer as order_case_count');
  });

  it("adds line type and contract year analysis blocks", () => {
    expect(sql).toContain("'line_type'");
    expect(sql).toContain("'contract_year'");
    expect(sql).toContain("coalesce(nullif(p_line_type, ''), '（元回線なし）')");
    expect(sql).toContain("coalesce(to_char(p_contract_month, 'YYYY'), '（契約時期なし）')");
  });

  it("defines vendor AND aggregation and purchase indexes", () => {
    expect(sql).toContain("soil_list_analysis_vendor_and");
    expect(sql).toContain('having count(distinct coalesce(nullif(sp."購入先_NEW", \'\'), sp."購入先")) = (select count(*) from selected_vendors)');
    expect(sql).toContain("soil_list_purchase_vendor_effective_phone_idx");
    expect(sql).toContain("soil_list_purchase_phone_vendor_effective_idx");
  });
});
