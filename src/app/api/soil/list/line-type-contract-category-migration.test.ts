import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(process.cwd(), "supabase", "migrations", "20260915000001_soil_list_line_type_contract_period_category.sql");
const sql = readFileSync(migrationPath, "utf8");

function arrayTerms(name: string): string[] {
  const match = new RegExp(`${name} constant text\\[\\] := array\\[([\\s\\S]*?)\\];`).exec(sql);
  if (!match) return [];
  return [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]);
}

describe("line type / contract month / category migration", () => {
  it("adds the derived columns and indexes", () => {
    expect(sql).toContain('add column if not exists "契約時期" date');
    expect(sql).toContain('add column if not exists "区分" text');
    expect(sql).toContain('add column if not exists "区分_判定元" text');
    expect(sql).toContain('add column if not exists "派生更新_at" timestamptz');
    expect(sql).toContain('create index if not exists soil_list_phone_line_type_idx');
    expect(sql).toContain('create index if not exists soil_list_phone_category_idx');
    expect(sql).toContain('create index if not exists soil_list_phone_contract_month_idx');
    expect(sql).not.toContain("concurrently");
  });

  it("defines the required derivation and backfill functions", () => {
    expect(sql).toContain("soil_list_derive_line_type");
    expect(sql).toContain("soil_list_derive_contract_month");
    expect(sql).toContain("soil_list_derive_category");
    expect(sql).toContain("soil_list_backfill_derived");
    expect(sql).toContain("returns table (updated integer, remaining integer)");
    expect(sql).toContain('"区分_判定元" is distinct from \'手入力\'');
  });

  it("keeps the agreed line type and category words visible in SQL", () => {
    expect(sql).toContain("'アナログ'");
    expect(sql).toContain("'フレッツ'");
    expect(sql).toContain("'au'");
    expect(sql).toContain("'混在'");
    expect(arrayTerms("v_corporate_terms")).toEqual(expect.arrayContaining(["株式会社", "有限会社", "合同会社", "社団法人", "組合"]));
    expect(arrayTerms("v_shop_terms")).toEqual(expect.arrayContaining(["商店", "工務店", "クリニック", "不動産", "サービス"]));
    expect(arrayTerms("v_suffix_terms")).toEqual(["屋", "店", "院", "園", "堂", "館", "社", "組", "亭"]);
  });

  it("refreshes options and extends upload apply results", () => {
    expect(sql).toContain("'住所_都道府県','AU光架電可否','購入状態','アポ禁','判定結果','東西','元回線','区分'");
    expect(sql).toContain("drop function if exists public.soil_list_apply_upload(uuid, integer)");
    expect(sql).toContain("line_type_set integer");
    expect(sql).toContain("category_set integer");
    expect(sql).toContain("public.soil_list_derive_line_type(a.\"リスト名\", null, null) as line_type");
    expect(sql).toContain("public.soil_list_derive_category");
  });
});
