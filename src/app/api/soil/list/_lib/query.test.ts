import { describe, expect, it } from "vitest";

import { getColumnName } from "@/app/system/list/_lib/list-fields";

import { applyParentFilters, buildSelect, maskPhone } from "./query";
import { buildSearchSql, normalizeSearchSort } from "./search-sql";

class QuerySpy {
  calls: string[] = [];

  eq(column: string, value: unknown) {
    this.calls.push(`eq:${column}:${String(value)}`);
    return this;
  }

  neq(column: string, value: unknown) {
    this.calls.push(`neq:${column}:${String(value)}`);
    return this;
  }

  gte(column: string, value: unknown) {
    this.calls.push(`gte:${column}:${String(value)}`);
    return this;
  }

  lte(column: string, value: unknown) {
    this.calls.push(`lte:${column}:${String(value)}`);
    return this;
  }

  ilike(column: string, value: string) {
    this.calls.push(`ilike:${column}:${value}`);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.calls.push(`in:${column}:${values.length}`);
    return this;
  }

  not(column: string, operator: string, value: unknown) {
    this.calls.push(`not:${column}:${operator}:${value}`);
    return this;
  }

  or(filters: string) {
    this.calls.push(`or:${filters}`);
    return this;
  }

  order(column: string) {
    this.calls.push(`order:${column}`);
    return this;
  }

  range(from: number, to: number) {
    this.calls.push(`range:${from}:${to}`);
    return this;
  }

  limit(count: number) {
    this.calls.push(`limit:${count}`);
    return this;
  }
}

describe("soil list query helpers", () => {
  it("converts allowed conditions to query builder calls", () => {
    const query = new QuerySpy();
    applyParentFilters(query, [
      { field: "prefecture", op: "eq", value: "大阪府" },
      { field: "listName", op: "contains", value: "サンプル" },
      { field: "listLoadedOn", op: "gte", value: "2026-01-01" },
      { field: "purchaseStatus", op: "in", value: ["未購入"] },
      { field: "callCount", op: "lte", value: 3 },
      { field: "purchaseHistoryExists", op: "eq", value: false },
    ]);

    expect(query.calls).toEqual([
      `eq:${getColumnName("prefecture")}:大阪府`,
      `ilike:${getColumnName("listName")}:%サンプル%`,
      `gte:${getColumnName("listLoadedOn")}:2026-01-01`,
      `in:${getColumnName("purchaseStatus")}:1`,
      `lte:${getColumnName("callCount")}:3`,
      `eq:${getColumnName("purchaseHistoryExists")}:false`,
    ]);
  });

  it("applies empty and not-empty conditions on parent columns", () => {
    const query = new QuerySpy();
    applyParentFilters(query, [
      { field: "appointmentBlocked", op: "empty" },
      { field: "prefecture", op: "notEmpty" },
    ]);

    expect(query.calls).toEqual([
      `or:${getColumnName("appointmentBlocked")}.is.null,${getColumnName("appointmentBlocked")}.eq.`,
      `not:${getColumnName("prefecture")}:is:null`,
      `neq:${getColumnName("prefecture")}:`,
    ]);
  });

  it("applies in-or-empty conditions with quoted PostgREST values", () => {
    const query = new QuerySpy();
    applyParentFilters(query, [
      { field: "appointmentBlocked", op: "inOrEmpty", value: ["戸建,一部", "録音(アポ禁)", '要"確認\\済'] },
    ]);

    expect(query.calls).toEqual([
      `or:${getColumnName("appointmentBlocked")}.in.("戸建,一部","録音(アポ禁)","要\\"確認\\\\済"),${getColumnName("appointmentBlocked")}.is.null,${getColumnName("appointmentBlocked")}.eq.`,
    ]);
  });

  it("centralizes selected table columns and masks phone values", () => {
    expect(buildSelect(["phoneNumber", "name"])).toBe(`${getColumnName("phoneNumber")},${getColumnName("name")}`);
    expect(maskPhone("0311112222")).toBe("031****22");
  });

  it("builds search SQL for the default condition", () => {
    expect(buildSearchSql({
      filters: [
        { field: "auCallAvailability", op: "eq", value: "○" },
        { field: "appointmentBlocked", op: "empty" },
      ],
    }, null, 1)).toMatchInlineSnapshot(`
      {
        "text": "select "電話番号", "氏名", "住所_都道府県", "住所_市区町村", "リスト名", "最終コール日_集約", "コール回数合計", "購入状態"
      from "soil_list_phone"
      where "AU光架電可否" = $1 and ("アポ禁" is null or "アポ禁" = '')
      order by "電話番号" asc
      limit 100 offset 0",
        "values": [
          "○",
        ],
      }
    `);
  });

  it("builds search SQL for prefecture in values", () => {
    expect(buildSearchSql({
      filters: [{ field: "prefecture", op: "in", value: ["大阪府", "奈良県"] }],
    }, { key: "name", direction: "asc" }, 2)).toMatchInlineSnapshot(`
      {
        "text": "select "電話番号", "氏名", "住所_都道府県", "住所_市区町村", "リスト名", "最終コール日_集約", "コール回数合計", "購入状態"
      from "soil_list_phone"
      where "住所_都道府県" = any($1)
      order by "氏名" asc nulls last, "電話番号" asc
      limit 100 offset 100",
        "values": [
          [
            "大阪府",
            "奈良県",
          ],
        ],
      }
    `);
  });

  it("builds search SQL for in-or-empty values", () => {
    expect(buildSearchSql({
      filters: [{ field: "appointmentBlocked", op: "inOrEmpty", value: ["戸建"] }],
    }, { key: "purchaseStatus", direction: "desc" }, 1)).toMatchInlineSnapshot(`
      {
        "text": "select "電話番号", "氏名", "住所_都道府県", "住所_市区町村", "リスト名", "最終コール日_集約", "コール回数合計", "購入状態"
      from "soil_list_phone"
      where ("アポ禁" = any($1) or "アポ禁" is null or "アポ禁" = '')
      order by "購入状態" desc nulls last, "電話番号" asc
      limit 100 offset 0",
        "values": [
          [
            "戸建",
          ],
        ],
      }
    `);
  });

  it("builds search SQL for escaped contains values", () => {
    expect(buildSearchSql({
      filters: [{ field: "listName", op: "contains", value: "A%_B\\C" }],
    }, { key: "lastCalledOn", direction: "desc" }, 1)).toMatchInlineSnapshot(`
      {
        "text": "select "電話番号", "氏名", "住所_都道府県", "住所_市区町村", "リスト名", "最終コール日_集約", "コール回数合計", "購入状態"
      from "soil_list_phone"
      where "リスト名" ilike $1 escape '\\'
      order by "最終コール日_集約" desc nulls last, "電話番号" asc
      limit 100 offset 0",
        "values": [
          "%A\\%\\_B\\\\C%",
        ],
      }
    `);
  });

  it("rejects search sort keys outside the allow list", () => {
    expect(() => normalizeSearchSort({ key: "source", direction: "asc" })).toThrow("使えない並べ替えが含まれています");
  });
});
