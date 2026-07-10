import { describe, expect, it } from "vitest";

import { expenseKindLabel } from "../expense-kind";

describe("expenseKindLabel", () => {
  it("labels known DB expense kind values", () => {
    expect(expenseKindLabel("individual")).toBe("個人経費");
    expect(expenseKindLabel("company")).toBe("会社経費");
  });

  it("keeps unknown values visible for diagnosis", () => {
    expect(expenseKindLabel("personal")).toBe("personal");
    expect(expenseKindLabel("unexpected")).toBe("unexpected");
  });

  it("returns an empty label for nullish values", () => {
    expect(expenseKindLabel(null)).toBe("");
    expect(expenseKindLabel(undefined)).toBe("");
  });
});
