import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({access:vi.fn(),rpc:vi.fn(),admin:vi.fn()}));
vi.mock("@/lib/bud/broadband/access",()=>({broadbandAccess:mocks.access}));
vi.mock("@/lib/supabase/admin",()=>({getSupabaseAdmin:mocks.admin}));
import { GET, PATCH } from "./route";
beforeEach(()=>{vi.clearAllMocks();mocks.access.mockResolvedValue({ok:true,admin:true,db:{rpc:mocks.rpc}});mocks.rpc.mockResolvedValue({error:null});});
it.each([{ok:false,status:401},{ok:true,admin:false}])("requires super admin: %j",async auth=>{
 mocks.access.mockResolvedValue(auth);expect((await GET()).status).toBe(403);
 expect((await PATCH(new Request("http://localhost",{method:"PATCH",body:"{}"}))).status).toBe(403);
 expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.admin).not.toHaveBeenCalled();
});
it.each([null,{}, {viewers:null},{viewers:[1]},{viewers:["x".repeat(101)]},{viewers:Array(2001).fill("a")}])("rejects malformed settings %#",async body=>{
 expect((await PATCH(new Request("http://localhost",{method:"PATCH",body:JSON.stringify(body)}))).status).toBe(400);expect(mocks.rpc).not.toHaveBeenCalled();
});
it("deduplicates before saving",async()=>{
 expect((await PATCH(new Request("http://localhost",{method:"PATCH",body:JSON.stringify({viewers:["a","a"]})}))).status).toBe(200);
 expect(mocks.rpc).toHaveBeenCalledWith("bud_bb_save_viewers",{p_viewers:["a"]});
});
it("returns Japanese save error",async()=>{
 mocks.rpc.mockResolvedValue({error:{message:"invalid employee"}});
 const response=await PATCH(new Request("http://localhost",{method:"PATCH",body:JSON.stringify({viewers:["a"]})}));
 expect(response.status).toBe(409);expect((await response.json()).error).toContain("保存できませんでした");
});
