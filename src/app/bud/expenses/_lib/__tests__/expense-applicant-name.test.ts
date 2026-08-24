import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { resolveExpenseApplicantGroupKey, resolveExpenseApplicantName } from "../expense-employees";

const employees = { "EMP-1": { name: "名簿 花子" } };

describe("expense applicant name", () => {
  it("uses a connected employee name", () => {
    expect(resolveExpenseApplicantName({ applicant_employee_id: "EMP-1", applicant_name_text: null }, employees)).toBe("名簿 花子");
  });

  it("uses imported text when the employee is absent or not connected", () => {
    expect(resolveExpenseApplicantName({ applicant_employee_id: null, applicant_name_text: "過去 太郎" }, employees)).toBe("過去 太郎");
    expect(resolveExpenseApplicantName({ applicant_employee_id: "OLD-1", applicant_name_text: "退職 次郎" }, employees)).toBe("退職 次郎");
  });

  it("prefers the employee and returns unassigned when neither source resolves", () => {
    expect(resolveExpenseApplicantName({ applicant_employee_id: "EMP-1", applicant_name_text: "過去 太郎" }, employees)).toBe("名簿 花子");
    expect(resolveExpenseApplicantName({ applicant_employee_id: null, applicant_name_text: "  " }, employees)).toBe("未設定");
  });

  it("gives text-only rows their own grouping key", () => {
    expect(resolveExpenseApplicantGroupKey({ applicant_employee_id: null, applicant_name_text: "会社名義" }, employees)).toBe("text:会社名義");
    expect(resolveExpenseApplicantGroupKey({ applicant_employee_id: null, applicant_name_text: null }, employees)).toBeNull();
  });

  it("selects and resolves the shared name in every display and export path", () => {
    const files = [
      "src/app/bud/expenses/_components/ExpenseBookingPanel.tsx",
      "src/app/bud/expenses/_components/ExpenseDonePanel.tsx",
      "src/app/bud/expenses/_components/ExpenseReviewPanel.tsx",
      "src/app/bud/expenses/_components/ExpenseFinalPanel.tsx",
      "src/app/api/bud/expense-booking/export/route.ts",
      "src/app/api/bud/expense-booking/ledger-export/route.ts",
    ];
    for (const file of files) {
      const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      expect(source, file).toContain("applicant_name_text");
      expect(source, file).toContain("resolveExpenseApplicantName");
    }
  });

  it("keeps normal Garden submissions employee-id-only and constrains long labels", () => {
    const submit = fs.readFileSync(path.join(process.cwd(), "src/app/m/bud/submit/page.tsx"), "utf8");
    expect(submit).not.toContain("applicant_name_text");
    const done = fs.readFileSync(path.join(process.cwd(), "src/app/bud/expenses/_components/ExpenseDonePanel.tsx"), "utf8");
    expect(done).toContain('maxWidth: 180');
    expect(done).toContain('textOverflow: "ellipsis"');
    const header = fs.readFileSync(path.join(process.cwd(), "src/app/bud/expenses/_components/ExpenseBookingGroupHeader.tsx"), "utf8");
    expect(header).toContain('overflowWrap: "anywhere"');
  });

  it("adds only the nullable import-name column in the migration", () => {
    const migration = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260824000003_bud_expense_applicant_name_text.sql"), "utf8");
    expect(migration).toContain("add column if not exists applicant_name_text text");
    expect(migration).not.toContain("not null");
    expect(migration).not.toContain("applicant_employee_id =");
  });
});
