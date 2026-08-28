import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync(
  "supabase/migrations/20260828000002_root_companies_full_profile.sql",
  "utf8",
);
describe("root companies full profile migration", () => {
  it("adds every scalar company profile column", () => {
    for (const column of [
      "fax",
      "fiscal_end_month",
      "invoice_registration_number",
      "telecom_notification_number",
      "employment_insurance_number",
      "labor_insurance_number",
      "tax_office",
      "agency_notification_number",
      "industry_classification",
      "domain",
      "representative_gender",
      "representative_birthday",
      "representative_address",
      "representative_mobile",
      "contact1_name",
      "contact1_phone",
      "contact2_name",
      "contact2_phone",
    ])
      expect(sql).toMatch(new RegExp(`add column if not exists ${column}\\s`));
  });
  it("constrains fiscal month to 1 through 12", () =>
    expect(sql).toMatch(/fiscal_end_month between 1 and 12/));
});
