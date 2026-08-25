import { beforeEach, describe, expect, it, vi } from "vitest";
import { createValidSalesMasterRecord } from "@/app/system/mypage/_lib/zenkaku-check";
const mocks=vi.hoisted(()=>({update:vi.fn(),maybeSingle:vi.fn(),datasetMaybeSingle:vi.fn()}));
vi.mock("@/lib/supabase/admin",()=>({getSupabaseAdmin:()=>({from:(table:string)=>table==="system_zenkaku_check_request"?{update:mocks.update}:table==="system_postal_datasets"?{select:()=>({eq:()=>({maybeSingle:mocks.datasetMaybeSingle})})}:{select:()=>({eq:()=>({in:()=>Promise.resolve({data:[],error:null})})})}})}));
import { POST } from "./route";
const id="00000000-0000-0000-0000-000000000001";
const request=(body:unknown,token="secret")=>new Request("http://x",{method:"POST",headers:{authorization:`Bearer ${token}`},body:JSON.stringify(body)});
describe("POST /api/system/zenkaku-agent/result",()=>{
  beforeEach(()=>{process.env.ZENKAKU_AGENT_SECRET="secret";mocks.update.mockReset();mocks.maybeSingle.mockReset();mocks.datasetMaybeSingle.mockResolvedValue({data:null,error:null});mocks.update.mockImplementation((values)=>({eq:()=>({eq:()=>({select:()=>({maybeSingle:mocks.maybeSingle}),values})})}));mocks.maybeSingle.mockResolvedValue({data:{id},error:null});});
  it("rejects bearer failures",async()=>{expect((await POST(request({id,outcome:"not_found"},"wrong"))).status).toBe(401);});
  it("evaluates immediately and stores findings without raw master PII",async()=>{const record={...createValidSalesMasterRecord({flag:"見込"}),customerName:"秘密氏名",address:"秘密住所",phone:"09000000000"};const res=await POST(request({id,outcome:"success",record}));expect(res.status).toBe(200);const saved=mocks.update.mock.calls[0][0];expect(saved.status).toBe("done");expect(saved.result.blocking[0].ruleId).toBe("R1");expect(JSON.stringify(saved)).not.toContain("秘密氏名");expect(JSON.stringify(saved)).not.toContain("09000000000");expect(saved).not.toHaveProperty("record");});
  it("stores not-found as a safe failure code",async()=>{await POST(request({id,outcome:"not_found"}));expect(mocks.update.mock.calls[0][0]).toMatchObject({status:"failed",result:null,error_code:"not_found"});});
});
