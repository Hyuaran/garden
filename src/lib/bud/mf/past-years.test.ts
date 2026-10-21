import { expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { backfillPastYears } from "./backfill";
import { MfClient } from "./client";
import { pastFiscalYears, transactionRange, transactionYears } from "./transactions";
it("uses April boundaries and lists only available past years newest first", () => {
  expect(transactionRange("fy:2025", "2026-04-01")).toEqual({start:"2025-04-01",end:"2026-03-31"});
  const dates = ["2024-03-31","2024-04-01","2026-03-31","2026-04-01"].map(date=>({date}));
  expect(transactionYears(dates)).toEqual([2026,2025,2024,2023]);
  expect(pastFiscalYears([2026,2024,2025,2025],"2026-04-01")).toEqual([2025,2024]);
});
it("preserves earlier rows and replaces bounded past ranges without touching observations", () => {
  const sql = readFileSync("supabase/migrations/20261021000004_bud_mf_past_years.sql","utf8");
  const [apply, past] = sql.split("create function public.bud_mf_store_past");
  for (const kind of ["bank","card"]) {
    expect(apply).toContain("delete from bud_mf_" + kind + "_transactions where date >= p_since;");
    expect(past).toContain("delete from bud_mf_" + kind + "_transactions where date >= p_since and date <= p_until;");
    expect(past).toContain("jsonb_populate_recordset(null::bud_mf_" + kind + "_transactions");
  }
  expect(past).not.toContain("bud_mf_bank_tx_seen");
  expect(past).not.toContain("bud_mf_accounts");
  expect(past).toContain("from public,anon,authenticated");
  expect(past).toContain("to service_role");
  expect(sql).not.toContain("where true");
  const previous = readFileSync("supabase/migrations/20261021000003_bud_mf_arrival.sql","utf8");
  expect(apply.slice(apply.indexOf(" insert into bud_mf_bank_tx_seen"),apply.indexOf(" delete from bud_mf_card_transactions"))).toBe(previous.slice(previous.indexOf(" insert into bud_mf_bank_tx_seen"),previous.indexOf(" delete from bud_mf_card_transactions")));
});
it("fetches half-years, shares account classification, stops on failure and resumes committed batches", async () => {
  const client = { accounts: vi.fn(async()=>[{id:"b",name:"銀行 HR"},{id:"c",name:"カード HR"}]), transactions: vi.fn(async(since: string)=>[
    {id:"1",connected_account_id:"b",date:since,content:"bank",value:1,side:"INCOME" as const,journalizing_status:"none"},
    {id:"2",connected_account_id:"c",date:since,content:"card",value:2,side:"EXPENSE" as const,journalizing_status:"done"}
  ]) };
  const completed = new Set<string>();
  const options = { now:new Date("2020-04-01T00:00:00Z"),completed,onComplete:async(key:string)=>{completed.add(key);} };
  const stored = new Map<string,unknown[]>();
  const store = vi.fn(async(since:string,until:string,card:unknown[],bank:unknown[])=>{stored.set(since,[...card,...bank]);});
  store.mockRejectedValueOnce(new Error("stop"));
  await expect(backfillPastYears(client,store,options)).rejects.toThrow("stop");
  expect(completed.size).toBe(0);
  await backfillPastYears(client,store,options);
  expect(client.transactions).toHaveBeenLastCalledWith("2019-10-01","2020-03-31");
  expect(store.mock.calls[1][2]).toEqual([expect.objectContaining({mf_account_id:"c"})]);
  expect(store.mock.calls[1][3]).toEqual([expect.objectContaining({mf_account_id:"b"})]);
  expect(stored.size).toBe(2);
  const calls = store.mock.calls.length;
  await backfillPastYears(client,store,options);
  expect(store).toHaveBeenCalledTimes(calls);
  await backfillPastYears(client,store,{now:options.now});
  expect(stored.size).toBe(2);
});
it("paginates MF transactions with 500 rows per request using a mocked transport", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({access_token:"test"})))
    .mockResolvedValueOnce(new Response(JSON.stringify({metadata:{total_pages:2},transactions:[]})))
    .mockResolvedValueOnce(new Response(JSON.stringify({metadata:{total_pages:2},transactions:[]})));
  await new MfClient("test",fetcher).transactions("2025-04-01","2025-09-30");
  expect(fetcher).toHaveBeenCalledTimes(3);
  const url = new URL(fetcher.mock.calls[2][0]);
  expect(url.searchParams.get("per_page")).toBe("500");
  expect(url.searchParams.get("page")).toBe("2");
});
