import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), "utf8");

describe("expense UI terminology", () => {
  it("uses the Booking and Done tab labels", () => {
    expect(read("src/app/bud/expenses/page.tsx")).toContain('<span class=\\"tab-item-jp\\">仕訳待ち</span>/ Booking');
    expect(read("src/app/bud/expenses/_components/ExpenseDoneEmbed.tsx")).toContain('<span class="tab-item-jp">完了</span>/ Done');
  });

  it("has no old visible wording in expense UI source", () => {
    const files = [
      "src/app/bud/expenses/page.tsx",
      "src/app/bud/expenses/_components/ExpenseBookingPanel.tsx",
      "src/app/bud/expenses/_components/ExpenseFinalPanel.tsx",
      "src/app/bud/expenses/_components/ExpenseReviewPanel.tsx",
      "src/app/bud/expenses/_components/ExpenseDonePanel.tsx",
      "src/app/bud/expenses/_lib/expense-soft-delete.ts",
    ];
    const source = files.map(read).join("\n");
    expect(source).not.toContain("仕訳化");
    expect(source).not.toContain("仕訳済");
  });

  it("keeps status values while mapping their display labels", () => {
    const source = read("src/app/bud/expenses/_components/ExpenseReviewPanel.tsx");
    expect(source).toContain('status === "journalize_pending"');
    expect(source).toContain('return "仕訳待ち"');
    expect(source).toContain('status === "journalized"');
    expect(source).toContain('return "完了"');
    expect(source).toContain('status === "submitted"');
    expect(source).toContain('return "承認待ち"');
  });

  it("does not offer Yayoi CSV from the Done tab", () => {
    expect(read("src/app/bud/expenses/_components/ExpenseDonePanel.tsx")).not.toContain("弥生");
  });
});
