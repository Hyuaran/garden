import { describe, expect, it } from "vitest";

import { summarizeInternalBlockRows, uniqueValidInternalBlockRows, type ParsedInternalBlockRow } from "./internal-block-parser";

const rows: ParsedInternalBlockRow[] = [
  { rowNumber: 2, phoneNumber: "0285720215", reason: "重クレーム" },
  { rowNumber: 3, phoneNumber: "0285720215", reason: "重複" },
  { rowNumber: 4, phoneNumber: "123", reason: "短い" },
  { rowNumber: 5, phoneNumber: "09011112222", reason: "" },
  { rowNumber: 6, phoneNumber: "0311112222", reason: "登録済み" },
];

describe("internal block parser summaries", () => {
  it("counts duplicate, invalid, missing reason, and already blocked rows", () => {
    expect(summarizeInternalBlockRows(rows, new Set(["0311112222"]))).toEqual({
      rowCount: 5,
      validRows: 1,
      duplicateRows: 1,
      invalidPhoneRows: 1,
      missingReasonRows: 1,
      alreadyBlockedRows: 1,
    });
  });

  it("keeps only rows that should be inserted", () => {
    expect(uniqueValidInternalBlockRows(rows, new Set(["0311112222"])).map((row) => row.phoneNumber)).toEqual(["0285720215"]);
  });
});
