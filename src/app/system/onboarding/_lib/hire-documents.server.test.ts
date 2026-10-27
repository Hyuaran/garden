vi.mock("@/lib/company-seal.server",()=>({loadCompanySeal:vi.fn(async()=>undefined),MISSING_COMPANY_SEAL:"missing seal"}));
import { expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
vi.mock("@/lib/minimum-wages.server",()=>({validateMinimumWage:vi.fn(async(p)=>{
 if(p.salaryKind==="monthly"&&!p.weeklyHours)return "週の所定時間を入れてください";
 return null;
})}));
vi.mock("@/app/root/contracts/_lib/employment-contract-pdf.server",()=>({renderEmploymentContractPdf:vi.fn()}));
vi.mock("@/app/system/mypage/_lib/todoke-pdf.server",()=>({renderNdaPdf:vi.fn(),renderEmergencyContactPdf:vi.fn()}));
vi.mock("./hire-candidates.server",()=>({HireError:class extends Error{constructor(message:string,public status=400){super(message);}}}));
import { missingDocumentFields,hireDocuments } from "./hire-documents.server";
import { renderNdaPdf } from "@/app/system/mypage/_lib/todoke-pdf.server";
import { renderEmergencyContactPdf } from "@/app/system/mypage/_lib/todoke-pdf.server";
import { renderEmploymentContractPdf } from "@/app/root/contracts/_lib/employment-contract-pdf.server";
it("creates all three documents for monthly salary",async()=>{
 const p={kind:"new",contractStart:"2026-10-01",contractEnd:"2027-10-01",jobType:"office",workLocation:"大阪",concludedOn:"2026-10-01"};
 const v={status:"submitted",name:"社員",address:"大阪",phone:"090",emergency_name:"家族",emergency_relation:"父",emergency_address:"大阪",emergency_phone:"090",nda_agreed_at:"2026-10-01",submitted_at:"2026-10-01",salary_kind:"月給",base_salary:100000,weekly_hours:15};
 const db={from:(table:string)=>{const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,single:async()=>({data:table==="system_hire_candidates"?{status:"hired",employee_id:"e",company_id:"c",employment_type:"正社員"}:{company_name:"会社",representative:"社長",address:"大阪"}}),maybeSingle:async()=>({data:table==="system_onboarding"?v:{payload:p}})};return q;}};
 vi.mocked(renderEmploymentContractPdf).mockResolvedValue(Buffer.from("contract"));vi.mocked(renderNdaPdf).mockResolvedValue(Buffer.from("nda"));vi.mocked(renderEmergencyContactPdf).mockResolvedValue(Buffer.from("contact"));
 const result=await hireDocuments({db:db as never,userId:"u"},"c");expect(result.files).toHaveLength(3);expect(renderEmploymentContractPdf).toHaveBeenCalledWith(expect.objectContaining({salaryKind:"monthly",hourlyWage:100000,weeklyHours:15}));
 vi.clearAllMocks();
});
it("names missing inputs before rendering",()=>{
 expect(missingDocumentFields({}, {},{})).toEqual(expect.arrayContaining(["住所","緊急連絡先の氏名","給与","契約終了日","会社の住所"]));
});
it("rejects unsubmitted inputs without generating documents",async()=>{
 const db={from:(table:string)=>{const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,single:async()=>({data:table==="system_hire_candidates"?{status:"hired",employee_id:"e",company_id:"c"}:{company_name:"会社"}}),maybeSingle:async()=>({data:{status:"draft"}})};return q;}};
 await expect(hireDocuments({db:db as never,userId:"u"},"c")).rejects.toMatchObject({status:409});expect(renderNdaPdf).not.toHaveBeenCalled();
});
