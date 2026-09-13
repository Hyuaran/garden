import { describe, expect, it } from "vitest";

import { getColumnName } from "@/app/system/list/_lib/list-fields";

import { buildCsvLine } from "./export-format";

describe("buildCsvLine", () => {
  it("quotes all fields, escapes quotes, formats dates, and keeps headers", () => {
    expect(buildCsvLine(["phoneNumber", "name", "listLoadedOn"])).toBe(
      `"${getColumnName("phoneNumber")}","${getColumnName("name")}","${getColumnName("listLoadedOn")}"`,
    );
    expect(buildCsvLine(["phoneNumber", "name", "listLoadedOn"], {
      phoneNumber: "0311112222",
      name: 'テスト"太郎',
      listLoadedOn: "2026-09-04",
    })).toBe("\"0311112222\",\"テスト\"\"太郎\",\"2026/09/04\"");
  });
});

