import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access:vi.fn(), admin:vi.fn(), sync:vi.fn(), cron:vi.fn() }));
vi.mock("@/lib/bud/mf/access",()=>({mfAccess:mocks.access}));
vi.mock("@/lib/supabase/admin",()=>({getSupabaseAdmin:mocks.admin}));
vi.mock("@/lib/bud/mf/sync",()=>({syncMf:mocks.sync}));
vi.mock("@/lib/cron-auth",()=>({verifyCronRequest:mocks.cron}));
import { PATCH } from "./route";
import { POST } from "./refresh/route";
import { GET } from "./cron/route";
import { GET as snapshot } from "./snapshot/route";
beforeEach(()=>vi.resetAllMocks());
const request = (body:unknown) => new Request("https://garden.test/api/bud/mf-accounts",{method:"PATCH",body:JSON.stringify(body)});
describe("MF route permissions",()=>{
  it("requires a valid cron secret before creating an admin client",async()=>{
    mocks.cron.mockReturnValue({ok:false,status:401,reason:"invalid"});
    expect((await GET(new Request("https://garden.test"))).status).toBe(401);
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.sync).not.toHaveBeenCalled();
  });
  it("protects midnight snapshots with the cron secret and requests a refresh plus baseline",async()=>{
    mocks.cron.mockReturnValue({ok:false,status:401,reason:"invalid"});
    expect((await snapshot(new Request("https://garden.test"))).status).toBe(401);
    expect(mocks.admin).not.toHaveBeenCalled();
    mocks.cron.mockReturnValue({ok:true}); mocks.admin.mockReturnValue("db"); mocks.sync.mockResolvedValue({ok:true});
    expect((await snapshot(new Request("https://garden.test"))).status).toBe(200);
    expect(mocks.sync).toHaveBeenCalledWith("db","cron",{snapshot:true});
  });
  it("rejects unauthenticated refresh and viewers with no visible account",async()=>{
    mocks.access.mockResolvedValue({ok:false,status:401});
    expect((await POST()).status).toBe(401);
    const limit = vi.fn().mockResolvedValue({data:[]});
    mocks.access.mockResolvedValue({ok:true,admin:false,db:{from:()=>({select:()=>({limit})})}});
    expect((await POST()).status).toBe(403);
    expect(mocks.sync).not.toHaveBeenCalled();
  });
  it("allows an assigned viewer to refresh but propagates the shared rate limit",async()=>{
    const limit = vi.fn().mockResolvedValue({data:[{mf_account_id:"1"}]});
    mocks.access.mockResolvedValue({ok:true,admin:false,db:{from:()=>({select:()=>({limit})})}});
    mocks.admin.mockReturnValue("admin-client");
    mocks.sync.mockResolvedValue({ok:false,busy:true,error:"1分以内"});
    expect((await POST()).status).toBe(429);
    expect(mocks.sync).toHaveBeenCalledWith("admin-client","button");
  });
  it("rejects settings changes from ordinary viewers",async()=>{
    const rpc = vi.fn(); mocks.access.mockResolvedValue({ok:true,admin:false,db:{rpc}});
    expect((await PATCH(request({action:"reorder",ids:["1"]}))).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("uses atomic ordering and settings RPCs under the authenticated session",async()=>{
    const rpc = vi.fn().mockResolvedValue({}); mocks.access.mockResolvedValue({ok:true,admin:true,db:{rpc}});
    expect((await PATCH(request({action:"reorder",ids:["b","a"]}))).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("bud_mf_reorder",{p_ids:["b","a"]});
    expect((await PATCH(request({action:"axis-order",axis:"bank",keys:["楽天銀行","みずほ銀行"]}))).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("bud_mf_reorder_axis",{p_axis:"bank",p_keys:["楽天銀行","みずほ銀行"]});
    expect((await PATCH(request({action:"axis-order",axis:"corp",keys:["HR","HR"]}))).status).toBe(400);
    expect((await PATCH(request({action:"settings",id:"a",viewers:["e1","e1"],hidden:true,book:" 科目 ",mode:"manual_check",note:"理由"}))).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("bud_mf_save_settings",{p_id:"a",p_viewers:["e1"],p_hidden:true,p_book:"科目",p_mode:"manual_check",p_note:"理由"});
    expect((await PATCH(request({action:"settings",id:"a",viewers:"all"}))).status).toBe(400);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
});
