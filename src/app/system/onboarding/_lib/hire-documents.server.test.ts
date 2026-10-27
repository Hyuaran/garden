import { expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
vi.mock("@/app/root/contracts/_lib/employment-contract-pdf.server",()=>({renderEmploymentContractPdf:vi.fn()}));
vi.mock("@/app/system/mypage/_lib/todoke-pdf.server",()=>({renderNdaPdf:vi.fn(),renderEmergencyContactPdf:vi.fn()}));
vi.mock("./hire-candidates.server",()=>({HireError:class extends Error{constructor(message:string,public status=400){super(message);}}}));
import { missingDocumentFields,hireDocuments } from "./hire-documents.server";
import { renderNdaPdf } from "@/app/system/mypage/_lib/todoke-pdf.server";
it("names missing inputs before rendering",()=>{
 expect(missingDocumentFields({}, {},{})).toEqual(expect.arrayContaining(["住所","緊急連絡先の氏名","給与","契約終了日","会社の住所"]));
});
it("rejects unsubmitted inputs without generating documents",async()=>{
 const db={from:(table:string)=>{const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,single:async()=>({data:table==="system_hire_candidates"?{status:"hired",employee_id:"e",company_id:"c"}:{company_name:"会社"}}),maybeSingle:async()=>({data:{status:"draft"}})};return q;}};
 await expect(hireDocuments({db:db as never,userId:"u"},"c")).rejects.toMatchObject({status:409});expect(renderNdaPdf).not.toHaveBeenCalled();
});
