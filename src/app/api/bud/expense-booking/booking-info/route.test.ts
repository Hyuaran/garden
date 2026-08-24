import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const route = fs.readFileSync(path.join(process.cwd(), "src/app/api/bud/expense-booking/booking-info/route.ts"), "utf8");
const migration = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260824000005_bud_expense_booking_completes.sql"), "utf8");

describe("expense booking completion", () => {
  it("atomically completes full booking information with audit fields", () => {
    expect(route).toContain('supabase.rpc("bud_complete_expense_booking"');
    expect(migration).toContain("status = 'journalized'");
    expect(migration).toContain("journalized_at = now()");
    expect(migration).toContain("journalized_by = auth.uid()");
    expect(migration).toContain("booking_date = p_booking_date");
    expect(migration).toContain("booking_corp_id = p_booking_corp_id");
    expect(migration).toContain("fiscal_period = nullif");
    expect(route).toContain("決算区分は必須です");
    expect(migration).toContain("cardinality(p_ids)");
  });

  it("reloads the booking queue and reports the move to Done", () => {
    const panel = fs.readFileSync(path.join(process.cwd(), "src/app/bud/expenses/_components/ExpenseBookingPanel.tsx"), "utf8");
    expect(panel).toContain("await load()");
    expect(panel).toContain("件の仕分け情報を保存し、完了へ移しました。");
  });

  it("migrates only active pending rows that already have a booking date", () => {
    expect(migration).toContain("journalized_at = booking_set_at");
    expect(migration).toContain("journalized_by = booking_set_by");
    expect(migration).toContain("status = 'journalize_pending'");
    expect(migration).toContain("booking_date is not null");
    expect(migration).toContain("deleted_at is null");
  });
});
