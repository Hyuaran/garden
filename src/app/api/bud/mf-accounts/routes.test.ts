import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access:vi.fn(), admin:vi.fn(), sync:vi.fn(), cron:vi.fn() }));
vi.mock("@/lib/bud/mf/access",()=>({mfAccess:mocks.access}));
vi.mock("@/lib/supabase/admin",()=>({getSupabaseAdmin:mocks.admin}));
vi.mock("@/lib/bud/mf/sync",()=>({syncMf:mocks.sync}));
vi.mock("@/lib/cron-auth",()=>({verifyCronRequest:mocks.cron}));
import { PATCH, GET as accountsGet } from "./route";
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
    mocks.access.mockResolvedValue({ok:true,admin:false,employeeId:"e",db:{from:()=>({select:()=>({limit})})}});
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
    expect(rpc).toHaveBeenCalledWith("bud_mf_save_settings",{p_id:"a",p_viewers:["e1"],p_hidden:true,p_book:"科目",p_mode:"manual_check",p_note:"理由",p_anchor_balance:null,p_anchor_date:null});
    expect((await PATCH(request({action:"settings",id:"a",viewers:"all"}))).status).toBe(400);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
});

it("saves anchor settings only for admins and rejects invalid values",async()=>{
 const rpc=vi.fn().mockResolvedValue({});
 const body={action:"settings",id:"a",viewers:[],hidden:false,book:"",mode:"anchor",note:"",anchor_balance:0,anchor_date:"2026-10-21"};
 mocks.access.mockResolvedValue({ok:true,admin:false,db:{rpc}});
 expect((await PATCH(request(body))).status).toBe(403); expect(rpc).not.toHaveBeenCalled();
 mocks.access.mockResolvedValue({ok:true,admin:true,db:{rpc}});
 expect((await PATCH(request(body))).status).toBe(200);
 expect(rpc).toHaveBeenCalledWith("bud_mf_save_settings",expect.objectContaining({p_mode:"anchor",p_anchor_balance:0,p_anchor_date:"2026-10-21"}));
 for(const change of [{anchor_balance:1.5},{anchor_balance:"100"},{anchor_date:"2026-02-30"}]) expect((await PATCH(request({...body,...change}))).status).toBe(400);
});

it("requires an explicit timezone and anchor amount for arrival settings", async () => {
 const rpc=vi.fn().mockResolvedValue({}); mocks.access.mockResolvedValue({ok:true,admin:true,db:{rpc}});
 const body={action:"settings",id:"a",viewers:[],hidden:false,book:"",mode:"arrival",note:"",anchor_balance:0,anchor_at:"2026-10-21T12:00:00+09:00"};
 expect((await PATCH(request(body))).status).toBe(200);
 expect(rpc).toHaveBeenCalledWith("bud_mf_save_settings",expect.objectContaining({p_anchor_at:body.anchor_at,p_mode:"arrival",p_anchor_balance:0}));
 for(const change of [{anchor_at:null},{anchor_at:"2026-10-21T12:00:00"},{anchor_balance:null}]) expect((await PATCH(request({...body,...change}))).status).toBe(400);
});

it("returns paginated transactions dated today (Japan) for visible banks only", async () => {
 vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-21T03:00:00Z"));
 try {
  const gt=vi.fn(); const eqs: unknown[][]=[]; const ranges: number[]=[];
  const accounts=[{mf_account_id:"a",visible_employee_ids:["e"],sort_order:0,kind:"bank",hidden:false,fiscal_start_date:"2026-04-01"},{mf_account_id:"hidden",kind:"bank",hidden:true}];
  const db={from:(table:string)=>{
   const q:any={select:()=>q,order:()=>q,gte:()=>q,lte:()=>q,eq:(...args:unknown[])=>{eqs.push(args);return q;},
    gt:(...args:unknown[])=>{gt(...args);return q;},
    range:async(offset:number)=>{if(table!=="bud_mf_bank_tx_seen")return {data:[]};ranges.push(offset);return {data:offset===0?Array.from({length:1000},(_,i)=>({mf_transaction_id:String(i),mf_account_id:"a",date:"2026-10-20",side:"INCOME",value:1,first_seen_at:"2026-10-20T15:01:00Z"})):[{mf_account_id:"a",side:"EXPENSE",value:70},{mf_account_id:"hidden",side:"INCOME",value:999}]};},
    then:(resolve:(v:unknown)=>unknown)=>Promise.resolve({data:table==="bud_mf_accounts"?accounts:[]}).then(resolve)};
   return q;
  }};
  mocks.access.mockResolvedValue({ok:true,admin:false,employeeId:"e",db});
  const result=await accountsGet(new Request("https://garden.test/api/bud/mf-accounts"));
  expect(result.status).toBe(200);
  const body=await result.json();
  expect(eqs).toContainEqual(["date","2026-10-21"]); expect(gt).not.toHaveBeenCalledWith("first_seen_at",expect.anything());
  expect(ranges).toEqual([0,1000]);
  expect(body.arrivalTotal).toEqual({income:1000,expense:70,delta:930});
  expect(body.arrivalByAccount).toEqual({a:body.arrivalTotal});
 } finally {vi.useRealTimers();}
});

it("saves group viewers only for super administrators and validates kind and ids",async()=>{
 const rpc=vi.fn().mockResolvedValue({});
 mocks.access.mockResolvedValue({ok:true,admin:false,db:{rpc}});
 expect((await PATCH(request({action:"group-viewers",kind:"bank",viewers:["e"]}))).status).toBe(403);
 expect(rpc).not.toHaveBeenCalled();
 mocks.access.mockResolvedValue({ok:true,admin:true,db:{rpc}});
 for(const kind of ["bank","card"]) {
 expect((await PATCH(request({action:"group-viewers",kind,viewers:["e","e"]}))).status).toBe(200);
 expect(rpc).toHaveBeenLastCalledWith("bud_mf_save_group_viewers",{p_kind:kind,p_viewers:["e"]});
 }
 for(const body of [{kind:"other",viewers:[]},{kind:"bank",viewers:[1]},{kind:"bank",viewers:null}]) expect((await PATCH(request({action:"group-viewers",...body}))).status).toBe(400);
});
