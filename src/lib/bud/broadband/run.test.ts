import { beforeEach, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({rpc:vi.fn(),from:vi.fn(),get:vi.fn(),send:vi.fn()}));
vi.mock("@/lib/supabase/admin",()=>({getSupabaseAdmin:()=>({rpc:m.rpc,from:m.from})}));
vi.mock("@/lib/kintone/records",()=>({getAllRecords:m.get}));
vi.mock("@/lib/chatwork/client",()=>({ChatworkClient:class {sendMessage=m.send;}}));
import { runRecon, saveReconResults } from "./run";
it("persists all results once in production, never in dry run",async()=>{
 const save=vi.fn();const results=[{row:{kintone_record_id:"1",raw:{入金確認:{value:"入金OK"}}},kind:"excluded",expected:110,fee:440,candidates:[]} ] as unknown as Parameters<typeof saveReconResults>[0];
 await saveReconResults(results,"2026-10-21",true,save);expect(save).not.toHaveBeenCalled();
 await saveReconResults(results,"2026-10-21",false,save);expect(save).toHaveBeenCalledTimes(1);expect(save).toHaveBeenCalledWith([expect.objectContaining({recon_status:"matched",expected_gross:110,recon_fee:440})]);
});
beforeEach(()=>{
 vi.clearAllMocks();vi.stubEnv("KINTONE_BROADBAND_APP_ID","174");vi.stubEnv("KINTONE_BROADBAND_TOKEN","test");vi.stubEnv("KINTONE_SUBDOMAIN","test");
 m.rpc.mockImplementation(async(name:string)=>({data:name==="bud_bb_claim" ? true : null,error:null}));
 m.get.mockResolvedValue([]);
});
it("garden master is unavailable and never reads Kintone",async()=>{
 m.from.mockReturnValue({select:()=>({single:async()=>({data:{record_master:"garden"},error:null})})});
 expect(await runRecon(false)).toEqual({error:"まだ使えません"});expect(m.get).not.toHaveBeenCalled();expect(m.rpc).toHaveBeenLastCalledWith("bud_bb_release",expect.anything());
});
it("dry run refreshes mirror but never fetches schema, writes Kintone or sends Chatwork",async()=>{
 const fetch=vi.fn(()=>{throw new Error("external access prohibited");});vi.stubGlobal("fetch",fetch);
 m.from.mockImplementation((table:string)=>{
  const chain={select:()=>chain,single:async()=>({data:{record_master:"kintone",recon_from:"2025-04-01",notify_from:"2026-10-01",date_window_before:10,date_window_after:7,excluded_partners:[]},error:null}),order:()=>chain,range:async()=>({data:[],error:null}),eq:async()=>({data:[],error:null})};
  expect(["bud_bb_settings","bud_bb_records","bud_bb_payee_rules","bud_mf_accounts"]).toContain(table);return chain;
 });
 expect(await runRecon(true)).toMatchObject({dryRun:true,counts:{matched:0}});
 expect(m.rpc).toHaveBeenCalledWith("bud_bb_replace_mirror",{p_rows:[]});expect(fetch).not.toHaveBeenCalled();expect(m.send).not.toHaveBeenCalled();vi.unstubAllGlobals();
});
it("overlapping cron is skipped",async()=>{m.rpc.mockResolvedValue({data:false,error:null});expect(await runRecon(false)).toMatchObject({skipped:true});expect(m.from).not.toHaveBeenCalled();});
