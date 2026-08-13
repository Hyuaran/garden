import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({resolve:vi.fn(),admin:vi.fn()}));
vi.mock("../_lib/auth",()=>({resolveAttendanceEmployee:mocks.resolve}));
vi.mock("@/lib/supabase/admin",()=>({getSupabaseAdmin:mocks.admin}));
import { GET } from "./route";

function adminClient() {
  let countCalls=0;
  return { from:()=>({
    select(_columns?:string,options?:{count?:string}) {
      if (options?.count) return { eq:async()=>({count:countCalls++===0?3:0,error:null}) };
      return {
        eq:()=>({range:async()=>({data:[],error:null})}),
        in:()=>({order:()=>({limit:async()=>({data:[{id:1,kot_sync_status:"unsent"}],error:null})})}),
      };
    },
  }) };
}

describe("GET attendance sync-status",()=>{
  beforeEach(()=>mocks.admin.mockReset());
  it("rejects staff before creating admin client",async()=>{mocks.resolve.mockResolvedValue({ok:true,employee:{id:"EMP-0001",name:"A",gardenRole:"staff"}});expect((await GET()).status).toBe(403);expect(mocks.admin).not.toHaveBeenCalled();});
  it.each(["manager","admin","super_admin"])("allows %s and reports export exclusions",async(role)=>{mocks.resolve.mockResolvedValue({ok:true,employee:{id:"EMP-0001",name:"A",gardenRole:role}});mocks.admin.mockReturnValue(adminClient());const response=await GET();expect(response.status).toBe(200);expect(await response.json()).toMatchObject({counts:{unsent:3,sending:0},exportSummary:{eligible:0,missingCode:0,outOfRange:0},limit:200});});
});
