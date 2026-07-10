import { describe, expect, it } from "vitest";

import { isExpenseTabKeyboardScopeActive, type TabScopeDocument } from "../expense-tab-scope";

function docWithClass(className: string | null): TabScopeDocument {
  return {
    getElementById: () =>
      className == null
        ? null
        : {
            classList: {
              contains: (token) => className.split(/\s+/).includes(token),
            },
          },
  };
}

describe("isExpenseTabKeyboardScopeActive", () => {
  it("allows keyboard shortcuts when no tab wrapper exists", () => {
    expect(isExpenseTabKeyboardScopeActive(docWithClass(null), "tab-submit")).toBe(true);
  });

  it("allows keyboard shortcuts only for the active tab", () => {
    expect(isExpenseTabKeyboardScopeActive(docWithClass("tab-content active"), "tab-submit")).toBe(true);
    expect(isExpenseTabKeyboardScopeActive(docWithClass("tab-content"), "tab-submit")).toBe(false);
  });
});
