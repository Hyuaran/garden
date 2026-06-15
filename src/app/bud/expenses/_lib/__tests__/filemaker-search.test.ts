import { describe, expect, it } from "vitest";

import {
  executeFileMakerSearch,
  matchOp,
  parseSearchOp,
  recordMatchesRequest,
  type SearchRecord,
} from "../filemaker-search";

const NOW = new Date("2026-07-15T09:00:00+09:00");

const records: SearchRecord[] = [
  {
    id: "r1",
    corp_id: "corp-a",
    category_id: "cat-travel",
    qualified_class: "yes",
    receipt_date: "2026-07-01",
    receipt_time: "09:30",
    amount: 5000,
    store_name: "Tokyo Coffee",
    qualified_number: "T1234567890123",
    description: "client meeting",
    applicant_employee_id: "Shoji Mikoto",
  },
  {
    id: "r2",
    corp_id: "corp-b",
    category_id: "cat-food",
    qualified_class: "no",
    receipt_date: "2026-07-20",
    receipt_time: "12:00",
    amount: 8000,
    store_name: "Osaka Diner",
    qualified_number: "T0000000000000",
    description: "team lunch",
    applicant_employee_id: "Yamada Taro",
  },
  {
    id: "r3",
    corp_id: "corp-a",
    category_id: "cat-supply",
    qualified_class: "yes",
    receipt_date: "2026-08-01",
    receipt_time: "18:15",
    amount: 900,
    store_name: "Kyoto Stationery",
    qualified_number: "",
    description: "pens",
    applicant_employee_id: "Sato Hana",
  },
];

describe("filemaker search", () => {
  it("// matches today", () => {
    expect(matchOp("receipt_date", "2026-07-15", parseSearchOp("//"), NOW)).toBe(true);
    expect(matchOp("receipt_date", "2026-07-14", parseSearchOp("//"), NOW)).toBe(false);
  });

  it("matches date ranges with month/day input", () => {
    const result = executeFileMakerSearch(records, [{ receipt_date: "7/1...7/31" }], NOW);
    expect(result.records.map((record) => record.id)).toEqual(["r1", "r2"]);
  });

  it("matches numeric comparisons", () => {
    expect(recordMatchesRequest(records[1], { amount: ">5000" }, NOW)).toBe(true);
    expect(recordMatchesRequest(records[0], { amount: ">=5000" }, NOW)).toBe(true);
    expect(recordMatchesRequest(records[2], { amount: "<5000" }, NOW)).toBe(true);
    expect(recordMatchesRequest(records[0], { amount: "<=5000" }, NOW)).toBe(true);
  });

  it("matches exact, contains, wildcard, and field exclude", () => {
    expect(recordMatchesRequest(records[0], { store_name: "==Tokyo Coffee" }, NOW)).toBe(true);
    expect(recordMatchesRequest(records[0], { store_name: "coffee" }, NOW)).toBe(true);
    expect(recordMatchesRequest(records[1], { store_name: "*Diner" }, NOW)).toBe(true);
    expect(recordMatchesRequest(records[1], { store_name: "!Tokyo" }, NOW)).toBe(true);
    expect(recordMatchesRequest(records[0], { store_name: "!Tokyo" }, NOW)).toBe(false);
  });

  it("ANDs fields within one sheet", () => {
    const result = executeFileMakerSearch(records, [{ corp_id: "corp-a", amount: ">1000" }], NOW);
    expect(result.records.map((record) => record.id)).toEqual(["r1"]);
  });

  it("ORs multiple include sheets", () => {
    const result = executeFileMakerSearch(records, [{ corp_id: "corp-b" }, { amount: "<1000" }], NOW);
    expect(result.records.map((record) => record.id)).toEqual(["r2", "r3"]);
  });

  it("subtracts omit sheets after include sheets", () => {
    const result = executeFileMakerSearch(records, [{ receipt_date: "7/1...8/31" }, { mode: "omit", amount: "<1000" }], NOW);
    expect(result.records.map((record) => record.id)).toEqual(["r1", "r2"]);
  });
});
