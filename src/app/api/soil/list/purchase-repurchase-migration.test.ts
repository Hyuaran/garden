import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(process.cwd(), "supabase", "migrations", "20260917000006_soil_list_purchase_repurchase.sql");
const sql = readFileSync(migrationPath, "utf8");

describe("purchase repurchase migration", () => {
  it("inserts purchase history from all upload targets and returns the split counts", () => {
    expect(sql).toContain("create temp table soil_list_purchase_insert_target");
    expect(sql).toContain("from soil_list_upload_target t");
    expect(sql).toContain("purchase_initial_inserted integer");
    expect(sql).toContain("purchase_repurchase_inserted integer");
    expect(sql).toContain("count(*) filter (where is_initial)::integer");
    expect(sql).toContain("count(*) filter (where not is_initial)::integer");
  });

  it("updates the phone ledger latest purchase values from purchase history", () => {
    expect(sql).toContain('"最新購入先" = latest.vendor');
    expect(sql).toContain('"最新購入日" = latest.purchased_on');
    expect(sql).toContain('"契約時期" = public.soil_list_derive_contract_month(latest.purchased_on, p."経過月数")');
    expect(sql).toContain('order by sp."購入日" desc nulls last, sp.ctid desc');
  });

  it("defines the backfill function for old uploads", () => {
    expect(sql).toContain("create or replace function public.soil_list_backfill_repurchases");
    expect(sql).toContain("returns table (target_count integer, inserted integer, remaining integer)");
    expect(sql).toContain("join public.soil_list_assignment a on a.upload_id = u.id");
    expect(sql).toContain('where nullif(u."購入先", \'\') is not null');
    expect(sql).toContain('and u."購入日" is not null');
  });

  it("adds filtered analysis and repurchase pair aggregation", () => {
    expect(sql).toContain("create or replace function public.soil_list_analysis_filtered");
    expect(sql).toContain("p_vendors text[]");
    expect(sql).toContain("p_line_types text[]");
    expect(sql).toContain("p_contract_years text[]");
    expect(sql).toContain("soil_list_analysis_purchase_filter_cell");
    expect(sql).toContain("primary key (vendor, line_type, contract_year, result)");
    expect(sql).toContain("soil_list_analysis_vendor_repurchase");
    expect(sql).toContain("soil_list_analysis_repurchase_pair");
    expect(sql).toContain("lag(n.vendor) over");
  });
});
