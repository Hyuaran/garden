import { beforeEach, expect, it, vi } from "vitest";
const state=vi.hoisted(()=>({history:[] as unknown[], submissions:[] as unknown[], hire:null as string|null, error:null as unknown}));
vi.mock("@/app/system/mypage/_lib/submission-server",()=>({requireEmployee:async()=>({employee_id:"self"})}));
vi.mock("@/lib/supabase/admin",()=>({getSupabaseAdmin:()=>({from:(table:string)=>{
 const result=()=>({data:table==="root_employees"?{hire_date:state.hire,birthday:"2000-01-01"}:table==="root_employee_profile_history"?state.history:state.submissions,error:state.error});
 return {select(){return this;},eq(_key:string,value:string){expect(value).toBe("self");return this;},in(){return this;},single:async()=>result(),then(resolve:(value:unknown)=>unknown){return Promise.resolve(result()).then(resolve);}};
}})}));
import { GET } from "./route";
import { SELF_CONFIRM_CATEGORIES } from "@/app/system/mypage/_lib/quarterly-confirm";
beforeEach(()=>{state.history=[];state.submissions=[];state.hire=null;state.error=null;});
it("未確認なら必要、全区分を記録した次のアクセスでは不要",async()=>{
 expect((await (await GET()).json()).required).toBe(true);
 state.history=SELF_CONFIRM_CATEGORIES.map(category=>({category,source:"employee_confirm",confirmed_by_employee_at:new Date().toISOString()}));
 expect((await (await GET()).json()).required).toBe(false);
});
it("送信した申告は承認前でも回答として扱う",async()=>{
 state.history=[{category:"dependents",source:"employee_confirm",confirmed_by_employee_at:new Date().toISOString()}];
 state.submissions=["emergency_contact","bank_account","commute_route"].map(submission_type=>({submission_type,created_at:new Date().toISOString()}));
 expect((await (await GET()).json()).required).toBe(false);
});
it("取得に失敗したときは確認不要と返さない",async()=>{
 state.error={message:"failed"};expect((await GET()).status).toBe(500);
});
