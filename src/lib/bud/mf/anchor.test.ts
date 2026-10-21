import { describe, it, expect } from "vitest";
import { calculateBalance, mergeAccounts } from "./balances";
import { summarize } from "./matrix";
import type { MfAccount, Transaction } from "./types";
const account: MfAccount = { mf_account_id:"b",name:"銀行",kind:"bank",sub_account_label:"",sort_order:0,hidden:false,visible_employee_ids:[],book_sub_account_name:"missing",balance_mode:"anchor",anchor_balance:1000,anchor_date:"2025-03-01",balance_note:"",balance:1000,unjournalized_count:0,fetched_at:"" };
const tx = (date:string, value:number, side:Transaction["side"], status="none", id="b"): Transaction => ({id:date,connected_account_id:id,date,content:"",value,side,journalizing_status:status});
describe("anchor balances",()=>{
 it("adds both journalized and pending movements after the anchor through today only",()=>{
 const transactions=[tx("2025-03-01",900,"INCOME"),tx("2025-03-02",100,"INCOME","done"),tx("2026-04-02",20,"EXPENSE"),tx("2026-10-21",30,"INCOME"),tx("2026-10-22",500,"INCOME"),tx("2026-10-21",500,"INCOME","none","other")];
 expect(calculateBalance(account,new Map(),transactions,"2026-10-21","2026-04-01")).toEqual({balance:1110,unjournalized_count:2});
 });
 it("excludes missing anchors from totals and accepts a zero anchor",()=>{
 for(const a of [{...account,anchor_balance:null},{...account,anchor_date:null}]) {
 expect(calculateBalance(a,new Map(),[]).balance).toBeNull();
 expect(summarize([a],[])).toMatchObject({balance:null,manual:1});
 }
 expect(calculateBalance({...account,anchor_balance:0},new Map(),[]).balance).toBe(0);
 expect(summarize([account],[])).toMatchObject({balance:1000,manual:0});
 });
 it("preserves anchor settings when merging",()=>{
 expect(mergeAccounts([{id:"b",name:"銀行"}],[account],[],"now")[0]).toMatchObject({anchor_balance:1000,anchor_date:"2025-03-01",balance_mode:"anchor"});
 });
});
