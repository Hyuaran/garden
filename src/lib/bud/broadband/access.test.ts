import { expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({rpc:vi.fn(),user:vi.fn()}));
vi.mock("@/app/_lib/supabase/server",()=>({createServerClient:async()=>({auth:{getUser:m.user},rpc:m.rpc})}));
import { broadbandAccess } from "./access";
it("requires signed in user, Bud access and the same admin RPC as RLS",async()=>{
 m.user.mockResolvedValue({data:{user:null}});expect(await broadbandAccess()).toMatchObject({ok:false,status:401});
 m.user.mockResolvedValue({data:{user:{id:"one"}}});m.rpc.mockImplementation(async(name:string)=>({data:name==="bud_has_access",error:null}));expect(await broadbandAccess()).toMatchObject({ok:false,status:403});
 m.rpc.mockResolvedValue({data:true,error:null});expect(await broadbandAccess()).toMatchObject({ok:true,userId:"one"});
});
