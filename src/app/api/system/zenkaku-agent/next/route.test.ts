import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("@/lib/supabase/admin",()=>({getSupabaseAdmin:()=>({rpc:mocks.rpc})}));
import { GET } from "./route";
describe("GET /api/system/zenkaku-agent/next",()=>{
  beforeEach(()=>{process.env.ZENKAKU_AGENT_SECRET="secret";mocks.rpc.mockReset();});
  it("rejects missing or wrong bearer",async()=>{expect((await GET(new Request("http://x"))).status).toBe(401);expect((await GET(new Request("http://x",{headers:{authorization:"Bearer wrong"}}))).status).toBe(401);});
  it("returns one atomic claim and does not return it twice",async()=>{mocks.rpc.mockResolvedValueOnce({data:[{id:"r1",sales_id:"L1"}],error:null}).mockResolvedValueOnce({data:[],error:null});const req=()=>new Request("http://x",{headers:{authorization:"Bearer secret"}});expect((await (await GET(req())).json()).request).toEqual({id:"r1",salesId:"L1"});expect((await (await GET(req())).json()).request).toBeNull();expect(mocks.rpc).toHaveBeenCalledWith("system_zenkaku_claim_next");});
});
