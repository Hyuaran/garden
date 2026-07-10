import { describe, expect, it } from "vitest";

import {
  buildExpenseDeleteConfirmMessage,
  canManageExpenseSoftDelete,
  containsJournalizedExpense,
  normalizeDeleteReason,
} from "../expense-soft-delete";
import { isMissingSoftDeleteColumnError } from "../expense-soft-delete-query";

describe("expense soft delete helpers", () => {
  it("limits controls to super_admin", () => {
    expect(canManageExpenseSoftDelete("super_admin")).toBe(true);
    expect(canManageExpenseSoftDelete("admin")).toBe(false);
    expect(canManageExpenseSoftDelete(null)).toBe(false);
  });

  it("requires a non-empty reason", () => {
    expect(normalizeDeleteReason("  duplicate  ")).toBe("duplicate");
    expect(normalizeDeleteReason("   ")).toBeNull();
  });

  it("warns for journalized rows", () => {
    expect(containsJournalizedExpense([{ id: "1", status: "journalized" }])).toBe(true);
    expect(buildExpenseDeleteConfirmMessage([{ id: "1", status: "journalized" }], "test")).toContain("仕訳済み");
  });

  it("detects missing soft-delete columns", () => {
    expect(isMissingSoftDeleteColumnError({ code: "42703", message: "column deleted_at does not exist" })).toBe(true);
    expect(isMissingSoftDeleteColumnError({ message: "Could not find delete_reason" })).toBe(true);
    expect(isMissingSoftDeleteColumnError({ code: "23505", message: "duplicate key" })).toBe(false);
  });
});
