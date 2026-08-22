import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({user:{id:"user-1"} as {id:string}|null,insert:vi.fn(),single:vi.fn()}));
vi.mock("@/app/_lib/supabase/server",()=>({createServerClient:async()=>({auth:{getUser:async()=>({data:{auth:{},user:mocks.user}})},from:()=>({insert:mocks.insert})})}));
import { POST } from "./route";

describe("POST /api/system/zenkaku-check",()=>{
  beforeEach(()=>{mocks.user={id:"user-1"};mocks.insert.mockReset();mocks.single.mockReset();mocks.insert.mockReturnValue({select:()=>({single:mocks.single})});mocks.single.mockResolvedValue({data:{id:"r1",status:"pending"},error:null});});
  it("creates a pending request owned by auth.uid",async()=>{const res=await POST(new Request("http://x",{method:"POST",body:JSON.stringify({salesId:" L1 "})}));expect(res.status).toBe(201);expect(mocks.insert).toHaveBeenCalledWith({sales_id:"L1",requested_by:"user-1",status:"pending"});});
  it("rejects unauthenticated and invalid input",async()=>{mocks.user=null;expect((await POST(new Request("http://x",{method:"POST",body:"{}"}))).status).toBe(401);mocks.user={id:"u"};expect((await POST(new Request("http://x",{method:"POST",body:"{}"}))).status).toBe(400);});
});
