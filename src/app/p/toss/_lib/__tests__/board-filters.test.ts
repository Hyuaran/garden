import { describe, expect, it } from "vitest";
import { matchesBoardColumnFilters } from "../board-filters";
import type { TossBoardRow } from "../board";

const row = { rank: "A", status: "対応中", products: ["電気", "ガス"] } as TossBoardRow;

describe("matchesBoardColumnFilters", () => {
  it("uses OR within a column", () => expect(matchesBoardColumnFilters(row, { rank: ["A", "B"] })).toBe(true));
  it("uses AND across columns", () => expect(matchesBoardColumnFilters(row, { rank: ["A"], status: ["受注"] })).toBe(false));
  it("matches each item of a multi-value field", () => expect(matchesBoardColumnFilters(row, { products: ["ガス"] })).toBe(true));
  it("treats an empty selection as all", () => expect(matchesBoardColumnFilters(row, { rank: [] })).toBe(true));
});
