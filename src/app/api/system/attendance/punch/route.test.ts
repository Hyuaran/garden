import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(()=>({resolve:vi.fn(),admin:vi.fn()}));
vi.mock("../_lib/auth",()=>({resolveAttendanceEmployee:mocks.resolve}));
vi.mock("@/lib/supabase/admin",()=>({getSupabaseAdmin:mocks.admin}));
import { POST } from "./route";
const id="123e4567-e89b-42d3-a456-426614174000";
const req=(body:unknown)=>new Request("http://localhost/api/system/attendance/punch",{method:"POST",headers:{"content-type":"application/json","user-agent":"test-agent"},body:JSON.stringify(body)});
const employee={ok:true,employee:{id:"EMP-0001",name:"社員A",gardenRole:"staff"}};
function client(options:{duplicate?:boolean;existingEmployee?:string;insertError?:string}={}){
  const saved={id:1,employee_id:employee.employee.id,punch_type:"clock_in",punched_at:"2026-08-13T01:03:07Z",kot_sync_status:"unsent"};
  const insert=vi.fn(()=>({select:()=>({single:async()=>options.duplicate?{data:null,error:{code:"23505"}}:options.insertError?{data:null,error:{code:options.insertError}}:{data:saved,error:null}})}));
  const select=vi.fn(()=>({eq:()=>({maybeSingle:async()=>({data:{...saved,employee_id:options.existingEmployee??employee.employee.id},error:null})})}));
  return {insert,select,from:vi.fn(()=>({insert,select}))};
}
describe("POST attendance punch",()=>{
  beforeEach(()=>{mocks.resolve.mockReset().mockResolvedValue(employee);mocks.admin.mockReset();});
  it("returns 409 for an unregistered user",async()=>{mocks.resolve.mockResolvedValue({ok:false,status:409,error:"未登録",errorCode:"EMPLOYEE_NOT_REGISTERED"});expect((await POST(req({punch_type:"clock_in",client_punch_id:id}))).status).toBe(409);expect(mocks.admin).not.toHaveBeenCalled();});
  it("validates punch type and UUID",async()=>{expect((await POST(req({punch_type:"other",client_punch_id:id}))).status).toBe(400);expect((await POST(req({punch_type:"clock_in",client_punch_id:"bad"}))).status).toBe(400);});
  it("uses the server-resolved employee and does not accept client timestamps",async()=>{const c=client();mocks.admin.mockReturnValue(c);const response=await POST(req({punch_type:"clock_in",client_punch_id:id,employee_id:"attacker",punched_at:"2000-01-01"}));expect(response.status).toBe(201);expect(c.insert).toHaveBeenCalledWith({employee_id:employee.employee.id,punch_type:"clock_in",client_punch_id:id,source:"web",user_agent:"test-agent"});expect(await response.json()).toMatchObject({ok:true,idempotent:false,punch:{punched_at:"2026-08-13T01:03:07Z"}});});
  it("returns the existing row for an idempotent retry",async()=>{const c=client({duplicate:true});mocks.admin.mockReturnValue(c);const response=await POST(req({punch_type:"clock_in",client_punch_id:id}));expect(response.status).toBe(200);expect(await response.json()).toMatchObject({ok:true,idempotent:true});});
  it("does not disclose another employee's ID collision",async()=>{const c=client({duplicate:true,existingEmployee:"EMP-0002"});mocks.admin.mockReturnValue(c);const response=await POST(req({punch_type:"clock_in",client_punch_id:id}));expect(response.status).toBe(409);expect(await response.json()).toEqual({ok:false,error:"打刻IDが競合しました"});});
});
