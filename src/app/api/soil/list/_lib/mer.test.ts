import iconv from "iconv-lite";
import { describe, expect, it } from "vitest";

import { getColumnName } from "@/app/system/list/_lib/list-fields";

import { buildMerBuffer } from "./mer";

describe("buildMerBuffer", () => {
  it("quotes all fields, uses CRLF, formats dates, and encodes cp932", () => {
    const result = buildMerBuffer(["phoneNumber", "name", "listLoadedOn"], [
      {
        [getColumnName("phoneNumber")]: "0311112222",
        [getColumnName("name")]: 'テスト"太郎',
        [getColumnName("listLoadedOn")]: "2026-09-04",
      },
      {
        [getColumnName("phoneNumber")]: "0644445555",
        [getColumnName("name")]: null,
        [getColumnName("listLoadedOn")]: "",
      },
    ]);

    const decoded = iconv.decode(result.buffer, "cp932");
    expect(decoded).toBe(
      `"${getColumnName("phoneNumber")}","${getColumnName("name")}","${getColumnName("listLoadedOn")}"\r\n` +
        "\"0311112222\",\"テスト\"\"太郎\",\"2026/09/04\"\r\n" +
        "\"0644445555\",\"\",\"\"\r\n",
    );
  });

  it("replaces characters that cannot round-trip through cp932", () => {
    const result = buildMerBuffer(["name"], [{ [getColumnName("name")]: "𠮷田" }]);
    const decoded = iconv.decode(result.buffer, "cp932");

    expect(decoded).toContain("\"〓田\"");
    expect(result.replacedChars).toBe(1);
  });
});
