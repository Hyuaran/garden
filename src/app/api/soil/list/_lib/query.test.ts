import { describe, expect, it } from "vitest";

import { getColumnName } from "@/app/system/list/_lib/list-fields";

import { applyParentFilters, buildSelect, maskPhone } from "./query";

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

  it("centralizes selected table columns and masks phone values", () => {
    expect(buildSelect(["phoneNumber", "name"])).toBe(`${getColumnName("phoneNumber")},${getColumnName("name")}`);
    expect(maskPhone("0311112222")).toBe("031****22");
  });
});
