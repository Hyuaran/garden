import { describe, expect, it } from "vitest";

import { DEFAULT_SOIL_LIST_CONDITION } from "@/app/system/list/_lib/list-fields";

import { buildSearchPlanSql, buildSearchSql, normalizeSearchSort, shouldUseFilterFirstSearch } from "./search-sql";

describe("search SQL", () => {
  it("filters line type/category and sorts by contract month", () => {
    const sql = buildSearchSql({
      filters: [
        { field: "lineType", op: "in", value: ["フレッツ"] },
        { field: "latestVendor", op: "in", value: ["Luna", "データ総研"] },
        { field: "category", op: "inOrEmpty", value: ["法人"] },
        { field: "contractMonth", op: "gte", value: "2016-09-16" },
      ],
    }, { key: "contractMonth", direction: "desc" }, 1);

    expect(sql.text).toContain("\"元回線\" = any($1)");
    expect(sql.text).toContain("\"最新購入先\" = any($2)");
    expect(sql.text).toContain("(\"区分\" = any($3) or \"区分\" is null or \"区分\" = '')");
    expect(sql.text).toContain("\"契約時期\" >= $4");
    expect(sql.text).toContain("order by \"契約時期\" desc nulls last, \"電話番号\" asc");
    expect(sql.values).toEqual([["フレッツ"], ["Luna", "データ総研"], ["法人"], "2016-09-16"]);
  });

  it("accepts contractMonth as a search sort key", () => {
    expect(normalizeSearchSort({ key: "contractMonth", direction: "asc" })).toEqual({ key: "contractMonth", direction: "asc" });
  });

  it("inlines the default partial-index filters and keeps other values parameterized", () => {
    const sql = buildSearchPlanSql({
      filters: [
        ...DEFAULT_SOIL_LIST_CONDITION.filters,
        { field: "prefecture", op: "eq", value: "螟ｧ髦ｪ蠎・" },
      ],
    });

    expect(sql.text).toContain("\"AU光架電可否\" = '○'");
    expect(sql.text).toContain("(\"アポ禁\" is null or \"アポ禁\" = '')");
    expect(sql.text).toContain("\"自社アポ禁\" = false");
    expect(sql.text).toContain("\"住所_都道府県\" = $1");
    expect(sql.values).toEqual(["螟ｧ髦ｪ蠎・"]);
  });

  it("builds the filter-first search query below the estimate threshold", () => {
    const sql = buildSearchSql(
      { filters: [{ field: "prefecture", op: "eq", value: "螟ｧ髦ｪ蠎・" }] },
      { key: "phoneNumber", direction: "asc" },
      2,
      { filterFirst: true },
    );

    expect(shouldUseFilterFirstSearch(99999)).toBe(true);
    expect(shouldUseFilterFirstSearch(100000)).toBe(false);
    expect(sql.text).toContain("with m as materialized");
    expect(sql.text).toContain("select ctid as _rid");
    expect(sql.text).toContain("join k on p.ctid = k._rid");
    expect(sql.text).toContain("limit 100 offset 100");
    expect(sql.values).toEqual(["螟ｧ髦ｪ蠎・"]);
  });
});
