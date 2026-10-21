import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { automaticAnchor, mergeAccounts, visibleAccounts } from "./balances";
import { syncMf } from "./sync";
import type { MfClient } from "./client";
import type { MfAccount, TrialRow } from "./types";
const rows: TrialRow[] = [{type:"account",name:"普通預金",rows:[{type:"sub_account",id:20,name:"普通",values:[0,0,0,100]}]}];
const item = {id:"new",name:"銀行",connected_sub_accounts:[{name:"支店",account_id:10,sub_account_id:20}]};
it("matches only one ordinary-deposit row by id or an unambiguous sub-account lookup", () => {
 expect(automaticAnchor(item, rows)).toBe("普通");
 expect(automaticAnchor(item, [{...rows[0],rows:[{type:"sub_account",name:"普通"}]}], [{id:20,name:"普通",account_id:10}])).toBe("普通");
 expect(automaticAnchor(item, [{...rows[0],rows:[{type:"sub_account",name:"普通"}]}])).toBeNull();
 expect(automaticAnchor(item, [...rows,...rows])).toBeNull();
 expect(automaticAnchor({...item,connected_sub_accounts:[...item.connected_sub_accounts,...item.connected_sub_accounts]}, rows)).toBeNull();
 expect(automaticAnchor(item, [{...rows[0],name:"売掛金"}])).toBeNull();
});
function fixture() {
 let saved: MfAccount[] = [];
 const rpc = vi.fn(async (name: string, args: any) => { if(name === "bud_mf_apply_fetch") saved = args.p_accounts; return {data:"run"}; });
 const db = { rpc, from: vi.fn(() => ({select: vi.fn(async () => ({data:saved})), update: vi.fn(() => ({eq:vi.fn().mockResolvedValue({})}))})) } as unknown as SupabaseClient;
 const client = {accounts:vi.fn().mockResolvedValue([item]), trialBalance:vi.fn().mockResolvedValue({start_date:"2026-04-01",rows}), subAccounts:vi.fn().mockResolvedValue([]), transactions:vi.fn().mockResolvedValue([
 {id:"t",connected_account_id:"new",date:"2026-10-01",value:20,side:"INCOME",journalizing_status:"none"},
 {id:"old",connected_account_id:"new",date:"2026-03-01",value:999,side:"INCOME",journalizing_status:"none"}
 ])} as unknown as MfClient;
 const notify = vi.fn().mockResolvedValue(undefined);
 const options = {client,key:"test",notify,now:new Date("2026-10-21T03:00:00Z")};
 return {db,rpc,client,notify,options, saved:()=>saved};
}
it("sets a new bank anchor using fiscal pending transactions and never replaces an existing anchor", async () => {
 const f=fixture(); expect(await syncMf(f.db,"button",f.options)).toEqual({ok:true});
 expect(f.saved()[0]).toMatchObject({balance_mode:"arrival",anchor_balance:120,balance:120,anchor_date:"2026-10-21",anchor_at:"2026-10-21T03:00:00.000Z",book_sub_account_name:"普通",visible_employee_ids:[],balance_note:"起点を自動で設定（帳簿＋未仕訳・2026/10/21）"});
 expect(f.notify).not.toHaveBeenCalled();
 vi.mocked(f.client.trialBalance).mockRejectedValue(new Error("unavailable"));
 await syncMf(f.db,"button",{...f.options,now:new Date("2026-10-22T03:00:00Z")});
 expect(f.saved()[0]).toMatchObject({anchor_balance:120,anchor_at:"2026-10-21T03:00:00.000Z"});
 expect(f.client.trialBalance).toHaveBeenCalledTimes(1);
});
it.each(["missing","ambiguous","unreadable"])("leaves %s mapping manual and notifies once after saving", async kind => {
 const f=fixture();
 if(kind==="unreadable") vi.mocked(f.client.trialBalance).mockRejectedValue(new Error("unavailable"));
 else vi.mocked(f.client.trialBalance).mockResolvedValue({start_date:"2026-04-01",rows:kind==="missing"?[]:[...rows,...rows]});
 expect(await syncMf(f.db,"cron",f.options)).toEqual({ok:true});
 expect(f.saved()[0]).toMatchObject({balance_mode:"manual_check",anchor_balance:null,balance_note:"帳簿との対応を確認中です",visible_employee_ids:[]});
 expect(f.notify).toHaveBeenCalledWith("口座残高：新しい口座『銀行』の最初の残高を自動で入れられませんでした。設定から入れてください");
 await syncMf(f.db,"cron",f.options); expect(f.notify).toHaveBeenCalledTimes(1);
});
it("unions individual and kind permissions while retaining hidden behavior", () => {
 const accounts=mergeAccounts([{id:"1",name:"銀行"},{id:"2",name:"カード"},{id:"3",name:"銀行"}],[],["unused"],"now");
 accounts[0].visible_employee_ids=["individual","both"]; accounts[2].hidden=true;
 const groups=[{kind:"bank" as const,employee_ids:["group","both"]}];
 for(const id of ["individual","group","both"]) expect(visibleAccounts(accounts,id,false,groups).map(a=>a.mf_account_id)).toEqual(["1"]);
 expect(visibleAccounts(accounts,"none",false,groups)).toEqual([]);
 expect(visibleAccounts(accounts,"none",true,groups)).toHaveLength(3);
 expect(accounts[1].visible_employee_ids).toEqual([]);
});
it("cleans group viewers inside apply, protects saves and stamps initial observations atomically", () => {
 const sql=readFileSync("supabase/migrations/20261021000009_bud_mf_group_viewers.sql","utf8");
 const cleanup=sql.slice(sql.indexOf("update bud_mf_group_viewers a"),sql.indexOf("insert into bud_mf_axis_order"));
 for(const text of ["unnest(a.employee_ids)","e.is_active=true","e.deleted_at is null","e.termination_date > (now() at time zone 'Asia/Tokyo')::date"]) expect(cleanup).toContain(text);
 expect(sql).toContain("public.bud_is_super_admin()"); expect(sql).toContain("updated_by=auth.uid()");
 expect(sql).toContain("g.kind=bud_mf_accounts.kind"); expect(sql).toContain("e.employee_id=any(g.employee_ids)");
 expect(sql).toContain("jsonb_set(x,'{anchor_at}',to_jsonb(now()))");
 const conflicts=sql.slice(sql.indexOf("on conflict (mf_account_id) do update"),sql.indexOf("update bud_mf_accounts a set visible_employee_ids"));
 expect(conflicts).not.toContain("anchor_balance ="); expect(conflicts).not.toContain("anchor_at =");
});
