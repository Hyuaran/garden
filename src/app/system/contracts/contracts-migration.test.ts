import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync(
  "supabase/migrations/20260828000003_system_contracts.sql",
  "utf8",
);
describe("system contracts migration", () => {
  it("creates ledger and Drive/template columns", () => {
    expect(sql).toContain("create table if not exists public.system_contracts");
    for (const c of [
      "counterparty",
      "company_id",
      "contract_type",
      "concluded_on",
      "note",
      "drive_file_id",
      "drive_url",
      "drive_folder_name",
      "template_file_id",
      "template_url",
      "template_generated_at",
      "created_by",
      "created_at",
    ])
      expect(sql).toMatch(new RegExp(`\\b${c}\\b`));
    expect(sql).toContain("enable row level security");
  });
  it("adds product and editable Word template columns", () => {
    const extension = readFileSync("supabase/migrations/20260828000004_system_contracts_product.sql", "utf8");
    expect(extension).toMatch(/add column if not exists product text/);
    expect(extension).toContain("template_docx_file_id");
    expect(extension).toContain("template_docx_url");
  });
});
