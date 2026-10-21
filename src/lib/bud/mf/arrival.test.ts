import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { arrivalTotals, calculateBalance } from "./balances";
import type { Arrival } from "./types";
const anchor = { mf_account_id: "a", book_sub_account_name: "", balance_mode: "arrival" as const, anchor_balance: 1000, anchor_at: "2026-10-20T15:00:00Z" };
const seen: Arrival[] = [
 { mf_transaction_id: "1", mf_account_id: "a", date: "2026-10-19", side: "INCOME", value: 200, first_seen_at: "2026-10-20T15:01:00Z" },
 { mf_transaction_id: "2", mf_account_id: "a", date: "2026-10-20", side: "EXPENSE", value: 70, first_seen_at: "2026-10-20T15:02:00Z" },
];
describe("arrival balances", () => {
 it("counts late prior-date arrivals and ignores journal status and book changes", () => {
  const tx = {id:"1", connected_account_id:"a", date:"2026-10-19", content:"", side:"INCOME" as const, value:999, journalizing_status:"none"};
  for (const journalizing_status of ["none", "done"]) expect(calculateBalance(anchor,new Map([["",9999]]),[{...tx,journalizing_status}],"2026-10-21",undefined,seen).balance).toBe(1130);
 });
 it("keeps the migrated balance when arrivals equal the anchor timestamp", () => {
  expect(calculateBalance(anchor,new Map(),[],undefined,undefined,seen.map(t=>({...t,first_seen_at:anchor.anchor_at}))).balance).toBe(1000);
 });
 it("keeps group delta equal to income minus expense and excludes other accounts", () => {
  expect(arrivalTotals([...seen,{...seen[0],mf_account_id:"hidden",value:999}], ["a"])).toEqual({income:200,expense:70,delta:130});
 });
 it("stores immutable first observations atomically before recalculating and seeds migration before today's midnight", () => {
  const sql=readFileSync("supabase/migrations/20261021000003_bud_mf_arrival.sql","utf8");
  expect(sql).toContain("on conflict (mf_transaction_id) do nothing");
  expect(sql).not.toMatch(/(?:delete from|update) (?:public\.)?bud_mf_bank_tx_seen/i);
  expect(sql).toContain("s.first_seen_at>a.anchor_at");
  // 切り替え時点で見えていた取引は「今日 0 時（日本時間）の 1 秒前」に届いた扱い＝今日の内訳に入らない
  expect(sql).toContain("select mf_transaction_id,mf_account_id,date,side,value,(date_trunc('day', now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo') - interval '1 second' from public.bud_mf_bank_transactions");
  expect(sql).toContain("anchor_balance=balance,anchor_at=now(),balance_mode='arrival'");
  expect(sql.indexOf("on conflict (mf_transaction_id) do nothing")).toBeLessThan(sql.indexOf("update bud_mf_accounts a set balance"));
 });
});
