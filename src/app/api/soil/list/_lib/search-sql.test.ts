import { describe, expect, it } from "vitest";

import { buildSearchSql, normalizeSearchSort } from "./search-sql";

describe("search SQL", () => {
  it("filters line type/category and sorts by contract month", () => {
    const sql = buildSearchSql({
      filters: [
        { field: "lineType", op: "in", value: ["フレッツ"] },
        { field: "category", op: "inOrEmpty", value: ["法人"] },
        { field: "contractMonth", op: "gte", value: "2016-09-16" },
      ],
    }, { key: "contractMonth", direction: "desc" }, 1);

    expect(sql.text).toContain("\"元回線\" = any($1)");
    expect(sql.text).toContain("(\"区分\" = any($2) or \"区分\" is null or \"区分\" = '')");
    expect(sql.text).toContain("\"契約時期\" >= $3");
    expect(sql.text).toContain("order by \"契約時期\" desc nulls last, \"電話番号\" asc");
    expect(sql.values).toEqual([["フレッツ"], ["法人"], "2016-09-16"]);
  });

  it("accepts contractMonth as a search sort key", () => {
    expect(normalizeSearchSort({ key: "contractMonth", direction: "asc" })).toEqual({ key: "contractMonth", direction: "asc" });
  });
});
