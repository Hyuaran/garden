import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(()=>({createServerClient:vi.fn(),redirect:vi.fn()}));
vi.mock("@/app/_lib/supabase/server",()=>({createServerClient:mocks.createServerClient}));
vi.mock("next/navigation",()=>({redirect:mocks.redirect}));
import MyPagePage from "../page";

const employee = { name:"社員A",name_kana:"シャインエー",employee_number:"EMP-1",employment_type:"正社員",birthday:"1980-08-13",email:"a@example.com",garden_role:"staff" };
function client(row:typeof employee|null=employee,user:{id:string}|null={id:"user-1"}) {
  const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),is:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({data:row,error:null})};
  return {query,auth:{getUser:vi.fn().mockResolvedValue({data:{user}})},from:vi.fn(()=>query)};
}

describe("system mypage server page",()=>{
  beforeEach(()=>{mocks.createServerClient.mockReset();mocks.redirect.mockReset();});
  it("queries the employee once and does not pass a registered birthday before unlock",async()=>{
    const db=client();mocks.createServerClient.mockResolvedValue(db);
    const view=await MyPagePage({searchParams:Promise.resolve({})}) as ReactElement<{initialProfile:unknown;birthdayRegistered:boolean;employeeName:string}>;
    expect(db.from).toHaveBeenCalledTimes(1);
    expect(view.props).toMatchObject({initialProfile:null,birthdayRegistered:true,employeeName:"社員A"});
    expect(JSON.stringify(view.props)).not.toContain("1980-08-13");
  });
  it("passes the profile only when birthday is unregistered and selects attendance from the query",async()=>{
    mocks.createServerClient.mockResolvedValue(client({...employee,birthday:null} as unknown as typeof employee));
    const view=await MyPagePage({searchParams:Promise.resolve({tab:"attendance"})}) as ReactElement<{initialProfile:{birthday:null};initialTab:string}>;
    expect(view.props.initialTab).toBe("attendance"); expect(view.props.initialProfile.birthday).toBeNull();
  });
  it("redirects unauthenticated users to the new return URL",async()=>{
    mocks.redirect.mockImplementation(()=>{throw new Error("redirected")});
    mocks.createServerClient.mockResolvedValue(client(employee,null));
    await expect(MyPagePage({searchParams:Promise.resolve({})})).rejects.toThrow("redirected");
    expect(mocks.redirect).toHaveBeenCalledWith("/login?returnTo=%2Fsystem%2Fmypage");
  });
});
