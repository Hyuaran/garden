import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({authorize:vi.fn(),admin:vi.fn()}));
vi.mock("./_lib/authorization",()=>({authorizeKotExport:mocks.authorize}));
vi.mock("@/lib/supabase/admin",()=>({getSupabaseAdmin:mocks.admin}));
import { POST as generate } from "./route";
import { POST as confirm } from "./confirm/route";
import { POST as revert } from "./revert/route";
import iconv from "iconv-lite";

describe("KOT export routes",()=>{
  beforeEach(()=>{mocks.authorize.mockReset().mockResolvedValue({identity:{employee:{gardenRole:"manager"}}});mocks.admin.mockReset();});
  it("rejects generation while a sending batch exists",async()=>{const query={select(){return this},eq:async()=>({count:1,error:null})};mocks.admin.mockReturnValue({from:()=>query});const response=(await generate())!;expect(response.status).toBe(409);expect(await response.json()).toMatchObject({ok:false});});
  it("claims only unsent rows, applies the 1000 limit, and returns Shift-JIS CSV",async()=>{
    const candidateIn={id:7,employee_id:"EMP-0001",punch_type:"clock_in",punched_at:"2026-08-13T04:26:00Z",root_employees:{name:"山田 太郎",kot_employee_id:"EMP001",attendance_rule:"sales"}};
    const candidateOut={id:8,employee_id:"EMP-0001",punch_type:"clock_out",punched_at:"2026-08-13T12:02:00Z",root_employees:{name:"山田 太郎",kot_employee_id:"EMP001",attendance_rule:"sales"}};
    const eqCandidate=vi.fn(); const limit=vi.fn(async()=>({data:[candidateIn,candidateOut],error:null}));
    const candidateQuery={eq:(...args:unknown[])=>{eqCandidate(...args);return candidateQuery},gte:()=>candidateQuery,lte:()=>candidateQuery,not:()=>candidateQuery,neq:()=>candidateQuery,order:()=>candidateQuery,limit};
    const claimUpdate=vi.fn(()=>({eq:()=>({in:()=>({select:async()=>({data:[{id:7},{id:8}],error:null})})})}));
    const kotTimeUpdate=vi.fn(()=>({eq:()=>({eq:async()=>({error:null})})}));
    const batchInsert=vi.fn(async()=>({error:null}));
    let call=0; mocks.admin.mockReturnValue({from:()=>{call++;if(call===1||call===3)return{select:()=>({eq:async()=>({count:0,error:null})})};if(call===2)return{select:()=>candidateQuery};if(call===4)return{update:claimUpdate};if(call===5||call===6)return{update:kotTimeUpdate};return{insert:batchInsert};}});
    const response=(await generate())!; expect(response.status).toBe(200); expect(response.headers.get("content-type")).toBe("text/csv; charset=Shift_JIS"); expect(response.headers.get("x-kot-export-count")).toBe("2"); expect(response.headers.get("x-kot-batch-id")).toBeTruthy(); expect(eqCandidate).toHaveBeenCalledWith("kot_sync_status","unsent"); expect(limit).toHaveBeenCalledWith(1000); expect(claimUpdate).toHaveBeenCalledWith(expect.objectContaining({kot_sync_status:"sending",kot_punched_at:null,kot_batch_id:expect.any(String)})); expect(batchInsert).toHaveBeenCalledWith(expect.objectContaining({status:"sending"})); expect(iconv.decode(Buffer.from(await response.arrayBuffer()),"Shift_JIS")).toBe("EMP001,山田 太郎,1,202608131400\r\nEMP001,山田 太郎,2,202608132100\r\n");
  });
  it.each([[confirm,"synced"],[revert,"unsent"]] as const)("updates every sending row",async(handler,status)=>{const select=vi.fn(async()=>({data:[{id:1}],error:null}));const eq=vi.fn(()=>({select}));const update=vi.fn(()=>({eq}));mocks.admin.mockReturnValue({from:()=>({update})});const response=(await handler())!;expect(response.status).toBe(200);expect(update).toHaveBeenCalledWith(expect.objectContaining({kot_sync_status:status}));expect(eq).toHaveBeenCalledWith("kot_sync_status","sending");expect(await response.json()).toMatchObject({updated:1});});
  it("rejects non-manager authorization before service-role access",async()=>{mocks.authorize.mockResolvedValue({response:new Response("forbidden",{status:403})});expect((await generate())!.status).toBe(403);expect(mocks.admin).not.toHaveBeenCalled();});
});
