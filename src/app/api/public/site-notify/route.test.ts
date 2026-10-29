import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, OPTIONS } from "./[site_key]/route";
const state=vi.hoisted(()=>({fail:false,employees:[] as unknown[],ids:["b","a","c","d","e"]}));
vi.mock("@/lib/supabase/admin",()=>({getSupabaseAdmin:()=>({from:(table:string)=>{
 const result=()=>({data:table==="root_employees"?state.employees:state.ids.map(employee_id=>({employee_id})),error:state.fail?{}:null});
 const query={select:()=>query,eq:()=>query,in:()=>query,order:()=>query,then:(resolve:(v:unknown)=>void)=>Promise.resolve(result()).then(resolve)};return query;
}})}));
const call=(key="hyuaran-company",secret="test")=>GET(new Request("https://example.test/api/public/site-notify/"+key,{headers:{"x-garden-site-key":secret}}),{params:Promise.resolve({site_key:key})});
describe("site notify API",()=>{
 beforeEach(()=>{vi.stubEnv("SITE_NOTIFY_SECRET","test");state.fail=false;state.ids=["b","a","c","d","e"];state.employees=[
 {employee_id:"a",name:"甲",chatwork_account_id:"123",is_active:true},
 {employee_id:"b",name:"乙",chatwork_account_id:"456",is_active:true},
 {employee_id:"c",name:"退職",chatwork_account_id:"789",is_active:false},
 {employee_id:"d",name:"番号なし",chatwork_account_id:" ",is_active:true},
 {employee_id:"e",name:"退職日経過",chatwork_account_id:"111",is_active:true,termination_date:"2020-01-01"}];});
 it("rejects wrong, missing or unconfigured secrets",async()=>{expect((await call(undefined,"wrong")).status).toBe(401);expect((await call(undefined,"")).status).toBe(401);vi.stubEnv("SITE_NOTIFY_SECRET","");expect((await call()).status).toBe(401);});
 it("returns 404 for unknown keys",async()=>expect((await call("unknown")).status).toBe(404));
 it("returns only active numbered employees in registration order without caching",async()=>{const response=await call();expect(response.status).toBe(200);expect(response.headers.get("Cache-Control")).toBe("no-store");expect(await response.json()).toEqual({mentions:[{id:"456",name:"乙さん"},{id:"123",name:"甲さん"}]});});
 it("handles empty recipients and database errors",async()=>{state.ids=[];expect(await (await call()).json()).toEqual({mentions:[]});state.fail=true;expect((await call()).status).toBe(503);});
 it("allows the custom header in preflight",async()=>expect((await OPTIONS()).headers.get("Access-Control-Allow-Headers")).toBe("x-garden-site-key"));
});
