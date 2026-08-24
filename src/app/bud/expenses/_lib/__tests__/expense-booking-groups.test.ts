import { describe, expect, it } from "vitest";

import {
  getGroupSelectionState,
  groupExpenseBookingRows,
  summarizeExpenseBookingSelection,
  updateGroupSelection,
  type ExpenseBookingGroupItem,
} from "../expense-booking-groups";

const rows: ExpenseBookingGroupItem[] = [
  { id: "m2", applicantKey: "EMP-2", applicantName: "宮永 ひかり", receiptDate: "2026-02-03", amount: 400, selectable: true },
  { id: "i2", applicantKey: "EMP-1", applicantName: "石原 孝志朗", receiptDate: "2026-01-28", amount: 100, selectable: true },
  { id: "unset", applicantKey: null, applicantName: "未設定", receiptDate: "2026-01-01", amount: 300, selectable: true },
  { id: "i1", applicantKey: "EMP-1", applicantName: "石原 孝志朗", receiptDate: "2026-01-27", amount: 200, selectable: false },
  { id: "m1", applicantKey: "EMP-2", applicantName: "宮永 ひかり", receiptDate: "2026-02-03", amount: 600, selectable: true },
];

describe("groupExpenseBookingRows", () => {
  it("sorts groups by employee name and places unassigned last", () => {
    const groups = groupExpenseBookingRows(rows);
    const expectedNames = ["石原 孝志朗", "宮永 ひかり"].sort((left, right) => left.localeCompare(right, "ja"));
    expect(groups.map((group) => group.applicantName)).toEqual([...expectedNames, "未設定"]);
  });

  it("sorts details by receipt date and preserves source order on the same date", () => {
    const groups = groupExpenseBookingRows(rows);
    expect(groups.find((group) => group.key === "EMP-1")?.items.map((item) => item.id)).toEqual(["i1", "i2"]);
    expect(groups.find((group) => group.key === "EMP-2")?.items.map((item) => item.id)).toEqual(["m2", "m1"]);
  });

  it("reports count and the exact sum of all details while selecting only valid rows", () => {
    const group = groupExpenseBookingRows(rows).find((item) => item.key === "EMP-1");
    expect(group).toMatchObject({ count: 2, totalAmount: 300, selectableIds: ["i2"] });
  });
});

describe("group selection", () => {
  it("selects and clears every selectable row in a group", () => {
    expect([...updateGroupSelection(new Set(["outside"]), ["a", "b"], true)].sort()).toEqual(["a", "b", "outside"]);
    expect([...updateGroupSelection(new Set(["a", "b", "outside"]), ["a", "b"], false)]).toEqual(["outside"]);
  });

  it("distinguishes none, partial, and all selections", () => {
    expect(getGroupSelectionState(["a", "b"], new Set())).toEqual({ checked: false, partial: false, selectedCount: 0 });
    expect(getGroupSelectionState(["a", "b"], new Set(["a"]))).toEqual({ checked: false, partial: true, selectedCount: 1 });
    expect(getGroupSelectionState(["a", "b"], new Set(["a", "b"]))).toEqual({ checked: true, partial: false, selectedCount: 2 });
  });

  it("updates selected count and amount while retaining the simultaneous queue totals", () => {
    expect(summarizeExpenseBookingSelection(rows, new Set(["i2", "m2"]))).toEqual({
      totalCount: 5,
      totalAmount: 1600,
      selectedCount: 2,
      selectedAmount: 500,
    });
  });
});
