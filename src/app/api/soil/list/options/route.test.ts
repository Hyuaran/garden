import { describe, expect, it } from "vitest";

import { mergeOptionRows, toOptionItems } from "../_lib/options";

describe("soil list options", () => {
  it("keeps the empty row in front of the top rows without duplicating it", () => {
    const merged = mergeOptionRows(
      [
        { value: "新潟県", row_count: 146300 },
        { value: null, row_count: 803630 },
        { value: "福島県", row_count: 127565 },
      ],
      [{ value: null, row_count: 803630 }],
    );

    expect(merged).toEqual([
      { value: null, row_count: 803630 },
      { value: "新潟県", row_count: 146300 },
      { value: "福島県", row_count: 127565 },
    ]);
  });

  it("formats actual values with counts and puts empty first", () => {
    const result = toOptionItems([
      { value: "○", row_count: 194 },
      { value: "", row_count: 2 },
      { value: "×", row_count: 71 },
    ]);

    expect(result).toEqual([
      { value: "", label: "（空欄）", count: 2, empty: true },
      { value: "○", label: "○", count: 194, empty: false },
      { value: "×", label: "×", count: 71, empty: false },
    ]);
  });
});
