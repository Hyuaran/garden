import { describe, expect, it } from "vitest";

import { buildExportCountSql, buildExportPhoneSql, buildExportSelectSql } from "./export-sql";

const condition = {
  filters: [
    { field: "auCallAvailability" as const, op: "eq" as const, value: "○" },
    { field: "appointmentBlocked" as const, op: "empty" as const },
  ],
};

describe("export SQL", () => {
  it("builds count SQL with the same condition parameters", () => {
    const sql = buildExportCountSql(condition);

    expect(sql.text).toContain("select count(*)::bigint as count");
    expect(sql.text).toContain("\"AU光架電可否\" = $1");
    expect(sql.text).toContain("(\"アポ禁\" is null or \"アポ禁\" = '')");
    expect(sql.values).toEqual(["○"]);
  });

  it("builds paged select SQL ordered by list date and phone number", () => {
    const sql = buildExportSelectSql(condition, ["phoneNumber", "name"], "listLoadedOnDesc", 5000, 10000);

    expect(sql.text).toContain("select \"電話番号\" as \"phoneNumber\", \"氏名\" as \"name\"");
    expect(sql.text).toContain("order by \"リスト投入日\" desc nulls last, \"電話番号\" asc");
    expect(sql.text).toContain("limit 5000 offset 10000");
    expect(sql.values).toEqual(["○"]);
  });

  it("uses phone number ordering when collecting record phone_numbers", () => {
    const sql = buildExportPhoneSql(condition, "listLoadedOnAsc", 50000);

    expect(sql.text).toContain("select \"電話番号\" as \"phoneNumber\"");
    expect(sql.text).toContain("order by \"リスト投入日\" asc nulls last, \"電話番号\" asc");
    expect(sql.text).toContain("limit 50000 offset 0");
  });
});

