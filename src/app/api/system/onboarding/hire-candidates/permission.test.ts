import {beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({allowed:"",view:vi.fn(),save:vi.fn(),hire:vi.fn(),list:vi.fn(),options:vi.fn(),line:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/auth/view-permission.server",()=>({viewPermissionContext:async()=>({userId:"staff",viewer:{role:"manager",employeeId:"EMP-1"}}),canView:m.view}));
vi.mock("@/lib/supabase/admin",()=>({getSupabaseAdmin:()=>({})}));
vi.mock("@/app/system/onboarding/_lib/hire-candidates.server",async original=>({...await original<object>(),saveCandidate:m.save,hireCandidate:m.hire,listCandidates:m.list,candidateOptions:m.options}));
vi.mock("@/app/system/onboarding/_lib/hire-line.server",()=>({checkHireLine:m.line}));
import {GET,POST} from "./route";
import {PATCH} from "./[id]/route";
import {POST as hire} from "./[id]/hire/route";
import {POST as line} from "./[id]/line/route";
import {POST as documents} from "./[id]/documents/route";
import {GET as filemakerRead,POST as filemakerWrite} from "./[id]/filemaker/route";
import {GET as options} from "./kot-options/route";
const params={params:Promise.resolve({id:"candidate"})};
const req=(body:unknown)=>new Request("http://localhost/api",{method:"POST",body:JSON.stringify(body)});
beforeEach(()=>{vi.clearAllMocks();m.allowed="";m.view.mockImplementation(async(_page:string,tab:string)=>tab===m.allowed);for(const fn of [m.save,m.hire,m.list,m.options,m.line])fn.mockResolvedValue({ok:true});});
it.each(["candidates","confirmations"])("manager can read and write only the granted %s tab",async tab=>{
 m.allowed=tab;
 expect((await GET(new Request("http://localhost/api?tab="+tab))).status).toBe(200);
 expect((await PATCH(req(tab==="confirmations"?{checklist:{contract_not_required:true}}:{status:"no_show"}),params)).status).toBe(200);
 expect(m.save).toHaveBeenCalledWith(expect.objectContaining({userId:"staff"}),expect.anything(),"candidate");
 expect((await PATCH(req(tab==="confirmations"?{status:"no_show"}:{checklist:{contract_signed:true}}),params)).status).toBe(403);
});
it("registration, hire, and options require candidates permission; LINE and identity require confirmations",async()=>{
 m.allowed="candidates";
 expect((await POST(req({}))).status).toBe(200);expect((await hire(req({}),params)).status).toBe(200);expect((await options()).status).toBe(200);
 expect((await line(req({action:"send"}),params)).status).toBe(403);expect((await PATCH(req({identity:{}}),params)).status).toBe(403);
 m.allowed="confirmations";
 expect((await POST(req({}))).status).toBe(403);expect((await hire(req({}),params)).status).toBe(403);expect((await options()).status).toBe(403);
 expect((await line(req({action:"send"}),params)).status).toBe(200);expect((await PATCH(req({identity:{}}),params)).status).toBe(200);
});

it("rejects documents and FileMaker when only candidates is granted",async()=>{
 m.allowed="candidates";
 expect((await documents(req({}),params)).status).toBe(403);
 expect((await filemakerRead(req({}),params)).status).toBe(403);
 expect((await filemakerWrite(req({}),params)).status).toBe(403);
});
