import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks = vi.hoisted(()=>({context:vi.fn(),canView:vi.fn(),admin:vi.fn(),server:vi.fn()}));
vi.mock("@/lib/auth/view-permission.server",()=>({viewPermissionContext:mocks.context,canView:mocks.canView}));
vi.mock("@/lib/supabase/admin",()=>({getSupabaseAdmin:mocks.admin}));
vi.mock("@/app/_lib/supabase/server",()=>({createServerClient:mocks.server}));
vi.mock("@/lib/kintone/records",()=>({createRecord:vi.fn(),getAllRecords:vi.fn()}));
vi.mock("@/app/root/_lib/roster-sync.server",()=>({syncRootRoster:vi.fn()}));
vi.mock("@/app/root/_lib/kot-api",()=>({createKotEmployee:vi.fn(),fetchKotHireEmployees:vi.fn(),fetchKotHireOptions:vi.fn()}));
import { onboardingAdminContext } from "@/app/system/onboarding/_lib/onboarding-admin.server";
import { hireAdminContext } from "@/app/system/onboarding/_lib/hire-candidates.server";
import { GET as hireGet, POST as hirePost } from "@/app/api/system/hire-candidates/route";
import { GET as detailGet, POST as detailPost } from "@/app/api/system/onboarding/admin/[employeeId]/route";
beforeEach(()=>{
  vi.resetAllMocks();
  mocks.context.mockResolvedValue({viewer:{role:"staff",employeeId:"EMP-1"},userId:"user"});
  mocks.canView.mockResolvedValue(true);
  const q={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),is:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({data:{garden_role:"staff",employee_id:"EMP-1"},error:null})};
  mocks.server.mockResolvedValue({auth:{getUser:vi.fn().mockResolvedValue({data:{user:{id:"user"}},error:null})},from:()=>q});
  mocks.admin.mockReturnValue({privileged:true});
});
it("設定で許可された社員は事務一覧・詳細を管理者接続で読める",async()=>{
  const context=await onboardingAdminContext(true);
  expect(context.supabase).toEqual({privileged:true});
  expect(context.canWrite).toBe(false);
  expect(mocks.canView).toHaveBeenCalledWith("system-onboarding","all",{role:"staff",employeeId:"EMP-1"});
});
it.each(["candidates","confirmations"] as const)("%sの閲覧許可後にだけ管理者接続を渡す",async tab=>{
  expect((await hireAdminContext(tab)).db).toEqual({privileged:true});
  expect(mocks.canView).toHaveBeenCalledWith("system-onboarding",tab,{role:"staff",employeeId:"EMP-1"});
});
it("未許可の入社予定者・事務詳細APIはデータ接続前に403",async()=>{
  mocks.canView.mockResolvedValue(false);
  expect((await hireGet(new Request("http://localhost/api/system/hire-candidates?tab=confirmations"))).status).toBe(403);
  const detailResponse = await detailGet(new Request("http://localhost"),{params:Promise.resolve({employeeId:"EMP-2"})});
  expect(detailResponse.status).toBe(403);
  expect(mocks.admin).not.toHaveBeenCalled();
});
it("閲覧を許可しても事務の書き込みと入社予定者の登録は広がらない",async()=>{
  await expect(onboardingAdminContext()).rejects.toMatchObject({status:403});
  const request=new Request("http://localhost/api/system/hire-candidates",{method:"POST",body:"{}"});
  expect((await hirePost(request)).status).toBe(403);
  const update = new Request("http://localhost/api/system/onboarding/admin/EMP-2",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"save",values:{}})});
  expect((await detailPost(update,{params:Promise.resolve({employeeId:"EMP-2"})})).status).toBe(403);
  expect(mocks.admin).not.toHaveBeenCalled();
});
