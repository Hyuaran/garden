import { expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({access:vi.fn(),run:vi.fn()}));
vi.mock("@/lib/bud/broadband/access",()=>({broadbandAccess:m.access}));
vi.mock("@/lib/bud/broadband/run",()=>({runRecon:m.run}));
import { POST } from "./route";
it("denies non admins before any reconciliation",async()=>{
 m.access.mockResolvedValue({ok:false,status:403});expect((await POST()).status).toBe(403);expect(m.run).not.toHaveBeenCalled();
});
it("runs production and shows busy without exposing results",async()=>{
 m.access.mockResolvedValue({ok:true});m.run.mockResolvedValue({skipped:true});const response=await POST();expect(await response.json()).toEqual({message:"確認中です"});expect(m.run).toHaveBeenCalledWith(false);
});
