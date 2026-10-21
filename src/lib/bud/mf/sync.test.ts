import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MfClient } from "./client";
import { syncMf } from "./sync";
import type { MfAccount } from "./types";

function fixture(failed = false) {
  const old: MfAccount = { mf_account_id:"b",name:"銀行",kind:"bank",sub_account_label:"",sort_order:0,hidden:false,visible_employee_ids:["e1"],book_sub_account_name:"普通",balance_mode:"auto",balance_note:"",balance:50,unjournalized_count:0,fetched_at:"old" };
  const select = vi.fn().mockResolvedValue({data:[old]});
  const eq = vi.fn().mockResolvedValue({});
  const update = vi.fn(() => ({eq}));
  const rpc = vi.fn().mockResolvedValue({data:"run"});
  const db = {from:vi.fn(() => ({select,update})),rpc} as unknown as SupabaseClient;
  const client = {
    accounts:vi.fn().mockResolvedValue([{id:"b",name:"銀行"},{id:"c",name:"カード"}]),
    trialBalance:vi.fn().mockResolvedValue({start_date:"2026-04-01",rows:[{type:"account",name:"普通預金",rows:[{type:"sub_account",name:"普通",values:[0,0,0,100]}]}]}),
    transactions: failed ? vi.fn().mockRejectedValue(new Error("MF に接続できませんでした")) : vi.fn().mockResolvedValue([
      {id:"1",connected_account_id:"b",date:"2026-04-20",content:"入金",value:10,side:"INCOME",journalizing_status:"none"},
      {id:"2",connected_account_id:"c",date:"2026-10-01",content:"利用",value:30,side:"EXPENSE",journalizing_status:"none"},
      {id:"3",connected_account_id:"c",date:"2026-04-01",content:"古い利用",value:40,side:"EXPENSE",journalizing_status:"none"},
    ]),
  } as unknown as MfClient;
  return {db,client,rpc,update,old};
}
describe("MF snapshot sync", () => {
  it("calculates fiscal-year balances and publishes only three calendar months of cards atomically", async () => {
    const f = fixture();
    expect(await syncMf(f.db,"button",{client:f.client,key:"key",viewers:"e1,e2",now:new Date("2026-10-20T00:00:00Z")})).toEqual({ok:true});
    expect(f.client.transactions).toHaveBeenCalledWith("2026-04-01","2026-10-20");
    const payload = f.rpc.mock.calls[1][1];
    expect(payload.p_accounts[0].balance).toBe(110);
    expect(payload.p_accounts[1]).toMatchObject({sort_order:1,visible_employee_ids:["e1","e2"],kind:"card"});
    expect(payload.p_transactions.map((t:{mf_transaction_id:string})=>t.mf_transaction_id)).toEqual(["2"]);
    expect(f.update).not.toHaveBeenCalled();
  });
  it("requests an atomic Japanese-date baseline only after a successful MF read", async () => {
    const f = fixture();
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-20T15:00:00Z"));
    try {
      expect(await syncMf(f.db,"cron",{client:f.client,key:"key",snapshot:true})).toEqual({ok:true});
      expect(f.rpc.mock.calls[1][1].p_snapshot_date).toBe("2026-10-21");
      expect(f.rpc.mock.calls[1][1].p_accounts[1].visible_employee_ids).toEqual(["EMP-0000","EMP-0004","EMP-0008"]);
    } finally { vi.useRealTimers(); }
  });
  it("records failure without applying a partial snapshot", async () => {
    const f = fixture(true);
    expect(await syncMf(f.db,"cron",{client:f.client,key:"key",viewers:"e1"})).toMatchObject({ok:false,error:"MF に接続できませんでした"});
    expect(f.rpc).toHaveBeenCalledTimes(1);
    expect(f.update).toHaveBeenCalledWith({ok:false,error:"MF に接続できませんでした"});
    expect(f.old.balance).toBe(50);
    expect(f.old.fetched_at).toBe("old");
  });
  it("does not contact MF when the shared rate limit or lock is active", async () => {
    const f = fixture(); f.rpc.mockResolvedValue({data:null});
    expect(await syncMf(f.db,"button",{client:f.client})).toMatchObject({busy:true});
    expect(f.client.accounts).not.toHaveBeenCalled();
  });
});

it("fetches anchor history before the fiscal year and retains fiscal pending counts", async()=>{
 const f=fixture(); Object.assign(f.old,{balance_mode:"anchor",anchor_balance:1000,anchor_date:"2025-01-01"});
 await syncMf(f.db,"button",{client:f.client,key:"key",now:new Date("2026-10-20T00:00:00Z")});
 expect(f.client.transactions).toHaveBeenCalledWith("2025-01-01","2026-10-20");
 expect(f.rpc.mock.calls[1][1].p_accounts[0]).toMatchObject({balance:1010,unjournalized_count:1,anchor_balance:1000,anchor_date:"2025-01-01"});
});
