import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(()=>({createServerClient:vi.fn(),redirect:vi.fn()}));
vi.mock("@/app/_lib/supabase/server",()=>({createServerClient:mocks.createServerClient}));
vi.mock("next/navigation",()=>({redirect:mocks.redirect}));
vi.mock("../_lib/mypage-profile.server",()=>({buildMyPageProfile:async(row:Record<string,unknown>)=>({name:row.name,birthday:null,bankName:null,branchName:null,commuteDailyAllowance:null,commuteMonthlyCap:null,mynaSubmitted:false})}));
import MyPagePage from "../page";

const employee = { employee_id:"EMP-0009",name:"社員A",name_kana:"シャインエー",employee_number:"EMP-1",employment_type:"正社員",birthday:"1980-08-13",email:"a@example.com",garden_role:"staff",company_id:"COMP-001" };
function client(row:typeof employee|null=employee,user:{id:string}|null={id:"user-1"}) {
  const from=vi.fn((table:string)=>{const data=table==="root_employees"?row:table==="root_companies"?{company_name:"株式会社A"}:null;return {select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),is:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({data,error:null})}});
  return {auth:{getUser:vi.fn().mockResolvedValue({data:{user}})},from};
}

describe("system mypage server page",()=>{
  beforeEach(()=>{mocks.createServerClient.mockReset();mocks.redirect.mockReset();});
  it("queries the employee once and does not pass a registered birthday before unlock",async()=>{
    const db=client();mocks.createServerClient.mockResolvedValue(db);
    const shell=await MyPagePage({searchParams:Promise.resolve({})}) as ReactElement<{activePath:string;user:{name:string;company:string;role:string};children:ReactElement<{initialProfile:unknown;birthdayRegistered:boolean;employeeName:string}>}>;
    expect(db.from).toHaveBeenCalledTimes(3);
    expect(shell.props).toMatchObject({activePath:"/system/mypage",user:{name:"社員A",company:"株式会社A",role:"staff"}});
    expect(shell.props.children.props).toMatchObject({initialProfile:null,birthdayRegistered:true,employeeName:"社員A"});
    expect(JSON.stringify(shell.props)).not.toContain("1980-08-13");
  });
  it("passes the profile only when birthday is unregistered and selects attendance from the query",async()=>{
    mocks.createServerClient.mockResolvedValue(client({...employee,birthday:null} as unknown as typeof employee));
    const shell=await MyPagePage({searchParams:Promise.resolve({tab:"attendance"})}) as ReactElement<{children:ReactElement<{initialProfile:{birthday:null};initialTab:string}>}>;
    expect(shell.props.children.props.initialTab).toBe("attendance"); expect(shell.props.children.props.initialProfile.birthday).toBeNull();
  });
  it("redirects unauthenticated users to the new return URL",async()=>{
    mocks.redirect.mockImplementation(()=>{throw new Error("redirected")});
    mocks.createServerClient.mockResolvedValue(client(employee,null));
    await expect(MyPagePage({searchParams:Promise.resolve({})})).rejects.toThrow("redirected");
    expect(mocks.redirect).toHaveBeenCalledWith("/login?returnTo=%2Fsystem%2Fmypage");
  });
});
