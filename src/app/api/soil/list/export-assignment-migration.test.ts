import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(process.cwd(), "supabase", "migrations", "20260917000007_soil_list_export_assignment.sql");
const sql = readFileSync(migrationPath, "utf8");

describe("export assignment migration", () => {
  it("adds FileMaker export metadata and expands source kinds", () => {
    expect(sql).toContain("add column if not exists list_name text");
    expect(sql).toContain("format in ('xlsx', 'csv', 'mer', 'fm_import')");
    expect(sql).toContain("source_kind in ('import_file', 'raw_excel', 'export')");
  });

  it("adds the 18 FileMaker fields to order history", () => {
    for (const column of [
      "申込者名_姓",
      "連絡担当者名_生年月日",
      "既契約者名_生年月日",
      "携帯キャリア",
      "設置先_住所_建物名",
      "電話番号_ハイフンなし",
      "携帯番号_ハイフンなし",
    ]) {
      expect(sql).toContain(`"${column}"`);
    }
  });

  it("branches apply_upload so export does not require purchase values or insert purchase history", () => {
    expect(sql).toContain("v_source_kind text := 'import_file'");
    expect(sql).toContain("v_source_kind <> 'export' and (v_purchase_vendor is null or v_purchase_date is null)");
    expect(sql).toContain("where v_source_kind <> 'export'");
    expect(sql).toContain("source_kind=export は購入履歴を増やさず");
  });

  it("fills only blank ledger fields from latest order values", () => {
    expect(sql).toContain("create or replace function public.soil_list_fill_phone_blanks_from_orders");
    expect(sql).toContain("coalesce(nullif(p.\"氏名_姓\", ''), latest.last_name)");
    expect(sql).toContain("order by o.\"電話番号\", o.\"受注日\" desc nulls last");
  });
});

