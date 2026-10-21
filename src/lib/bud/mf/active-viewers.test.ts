import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("prunes inactive viewers after account upsert within the atomic fetch and rejects them on save", () => {
  const sql = readFileSync("supabase/migrations/20261021000007_bud_mf_viewers_active.sql", "utf8");
  const cleanup = sql.slice(sql.indexOf("update bud_mf_accounts a set visible_employee_ids"), sql.indexOf("insert into bud_mf_axis_order"));
  expect(cleanup).toContain("array(select v from unnest(a.visible_employee_ids)");
  expect(cleanup).toContain("where exists (select 1 from unnest(a.visible_employee_ids)");
  for (const predicate of ["e.is_active=true", "e.deleted_at is null", "e.termination_date > (now() at time zone 'Asia/Tokyo')::date"]) {
    expect(cleanup.split(predicate)).toHaveLength(3);
  }
  expect(sql.indexOf("on conflict (mf_account_id) do update")).toBeLessThan(sql.indexOf(cleanup));
  expect(sql.indexOf(cleanup)).toBeLessThan(sql.indexOf("set ok = true"));
  expect(sql).toContain("delete from bud_mf_card_transactions where date >= p_since");
  expect(sql).toContain("delete from bud_mf_bank_transactions where date >= p_since");
  const save = sql.slice(sql.indexOf("create or replace function public.bud_mf_save_settings_before_mail"));
  expect(save).toContain("and is_active=true");
  expect(save).toContain("and deleted_at is null");
  expect(save).toContain("termination_date > (now() at time zone 'Asia/Tokyo')::date");
  expect(save).toContain("raise exception 'invalid employee'");
  expect(save).toContain("from public,anon,authenticated");
});
