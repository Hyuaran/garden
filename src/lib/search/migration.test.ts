import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { SEARCH_SOURCES } from "./catalog";

const sql = readFileSync("supabase/migrations/20261030000497_search_text.sql", "utf8");
type Spec = { table: string; fields: { path: string[]; phone: boolean }[] }[];
const spec: Spec = JSON.parse(sql.split("$catalog$")[1]);

it("indexes exactly the catalog field/title union, with only the explicit JSON paths", () => {
  const expected = new Map<string, Map<string, boolean>>();
  for (const source of SEARCH_SOURCES) {
    const fields = expected.get(source.table) ?? new Map<string, boolean>();
    expected.set(source.table, fields);
    for (const field of [...source.fields, { column: source.title, phone: false }]) {
      const path = ("select" in field && field.select ? field.select : field.column).split(":").at(-1)!.split(/->>?/);
      const key = JSON.stringify(path);
      fields.set(key, (fields.get(key) ?? false) || field.phone);
    }
  }
  expect(spec.map(source => source.table).sort()).toEqual([...expected.keys()].sort());
  expect(new Set(spec.map(source => source.table)).size).toBe(spec.length);
  expect(spec.some(source => source.table === "soil_list_phone")).toBe(false);
  for (const source of spec) {
    expect(new Map(source.fields.map(field => [JSON.stringify(field.path), field.phone]))).toEqual(expected.get(source.table));
    expect(source.fields.every(field => field.path.every(part => /^[\p{L}_][\p{L}\p{N}_]*$/u.test(part)))).toBe(true);
  }
  expect(sql).not.toMatch(/to_jsonb\s*\(|row_to_json\s*\(/i);
});

it("guards schema drift, builds search views and trigram expression indexes with immutable helpers", () => {
  expect(sql).toContain("information_schema.columns");
  expect(sql).toContain("to_regclass");
  expect(sql).not.toContain("ADD COLUMN search_text");
  expect(sql).toContain("WITH (security_invoker = true)");
  expect(sql).toContain("REVOKE ALL ON public.%I FROM anon");
  expect(sql).toContain("gin_trgm_ops)");
  const helpers = sql.split("DO $migration$")[0].split("CREATE OR REPLACE FUNCTION").slice(1);
  expect(helpers).toHaveLength(4);
  for (const helper of helpers) expect(helper).toMatch(/LANGUAGE sql IMMUTABLE PARALLEL SAFE/);
  expect(sql).toContain("SET TimeZone = 'UTC' SET DateStyle = 'ISO, YMD'");
  expect(sql).toContain("AT TIME ZONE ''Asia/Tokyo''");
  expect(sql).toContain("'YYYY-MM-DD'");
  expect(sql).toContain("'YYYY/MM/DD'");
  expect(sql).toMatch(/END;\s*\$migration\$;/);
});
