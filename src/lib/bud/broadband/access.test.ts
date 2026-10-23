import { expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({rpc:vi.fn(),user:vi.fn(),employee:vi.fn()}));
vi.mock("@/app/_lib/supabase/server",()=>({createServerClient:async()=>({auth:{getUser:m.user},rpc:m.rpc})}));
vi.mock("@/lib/supabase/admin",()=>({getSupabaseAdmin:()=>({from:()=>({select:()=>({eq:()=>({is:()=>({maybeSingle:m.employee})})})})})}));
import { broadbandAccess } from "./access";
it("requires signed in user and the same viewer RPC as RLS, and tells super_admin apart",async()=>{
 m.user.mockResolvedValue({data:{user:null}});expect(await broadbandAccess()).toMatchObject({ok:false,status:401});
 m.user.mockResolvedValue({data:{user:{id:"one"}}});m.rpc.mockResolvedValue({data:false,error:null});expect(await broadbandAccess()).toMatchObject({ok:false,status:403});
 expect(m.rpc).toHaveBeenLastCalledWith("bud_bb_can_view");
 m.rpc.mockResolvedValue({data:true,error:null});
 m.employee.mockResolvedValue({data:{employee_id:"EMP-0004",garden_role:"admin"},error:null});
 expect(await broadbandAccess()).toMatchObject({ok:true,userId:"one",admin:false,employeeId:"EMP-0004"});
 m.employee.mockResolvedValue({data:{employee_id:"EMP-0008",garden_role:"super_admin"},error:null});
 expect(await broadbandAccess()).toMatchObject({ok:true,admin:true});
});
