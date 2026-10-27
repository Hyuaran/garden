import { validateMinimumWage } from "@/lib/minimum-wages.server";
import "server-only";
import { renderEmploymentContractPdf } from "@/app/root/contracts/_lib/employment-contract-pdf.server";
import { validateContract, type EmploymentContractPayload } from "@/app/root/contracts/_lib/employment-contract";
import { renderNdaPdf, renderEmergencyContactPdf } from "@/app/system/mypage/_lib/todoke-pdf.server";
import { HireError, hireAdminContext } from "./hire-candidates.server";

export function missingDocumentFields(values:Record<string,unknown>,company:Record<string,unknown>,payload:Partial<EmploymentContractPayload>) {
 const fields:Record<string,unknown>={"氏名":values.name,"住所":values.address,"電話番号":values.phone,"緊急連絡先の氏名":values.emergency_name,"緊急連絡先の続柄":values.emergency_relation,"緊急連絡先の住所":values.emergency_address,"緊急連絡先の電話番号":values.emergency_phone,"秘密保持の同意日":values.nda_agreed_at,"会社名":company.company_name,"会社の代表者":company.representative,"会社の住所":company.address,"契約開始日":payload.contractStart,"契約終了日":payload.contractEnd,"業務内容":payload.jobType,"勤務場所":payload.workLocation,"契約日":payload.concludedOn,"給与区分":values.salary_kind,"給与":values.base_salary};
 if(payload.jobType==="other")fields["その他の業務内容"]=payload.jobTypeOther;
 fields["本人の提出日"]=values.submitted_at;
 if(values.emergency_relation==="その他")fields["緊急連絡先の続柄（その他）"]=values.emergency_relation_other;
 return Object.entries(fields).filter(([,v])=>v==null||!String(v).trim()).map(([k])=>k);
}
export async function hireDocuments({db}:Awaited<ReturnType<typeof hireAdminContext>>,id:string) {
 const {data:c,error:ce}=await db.from("system_hire_candidates").select("status,employee_id,company_id,employment_type").eq("id",id).single();
 if(ce||c?.status!=="hired")throw new HireError("入社済みの方だけ書類を作れます",409);
 const [input,company,contract]=await Promise.all([
  db.from("system_onboarding").select("status,name,address,phone,emergency_name,emergency_relation,emergency_relation_other,emergency_address,emergency_phone,nda_agreed_at,submitted_at,salary_kind,base_salary,weekly_hours").eq("employee_id",c.employee_id).maybeSingle(),
  db.from("root_companies").select("company_name,representative,address").eq("company_id",c.company_id).single(),
  db.from("system_employment_contracts").select("payload").eq("employee_id",c.employee_id).order("created_at",{ascending:false}).limit(1).maybeSingle(),
 ]);
 if(input.error||company.error||contract.error)throw new HireError("書類の情報を読み込めませんでした",503);
 const v=input.data,co=company.data;
 if(!v||v.status!=="submitted")throw new HireError("本人の入力が提出されると作れます",409);
 const p=(contract.data?.payload??{}) as Partial<EmploymentContractPayload>;
 const missing=missingDocumentFields(v,co??{},p);
 if(!c.employment_type)missing.push("雇用形態");
 if(missing.length)throw new HireError("足りない項目："+missing.join("・")+"。入社手続きの事務欄・雇用契約書の欄を確認してください",409);
 if(!["時間給","月給"].includes(v.salary_kind))throw new HireError("給与区分を選んでください",409);
 const payload={...p,salaryKind:v.salary_kind==="時間給"?"hourly":"monthly",weeklyHours:Number(String(v.weekly_hours??"").replace(/,/g,"")),hourlyWage:Number(String(v.base_salary).replace(/,/g,"")),employeeAddress:v.address} as EmploymentContractPayload;
 const invalid=validateContract(c.employee_id,payload);if(invalid)throw new HireError("雇用契約書："+invalid,409);
 const wageInvalid=await validateMinimumWage(payload); if(wageInvalid)throw new HireError(wageInvalid,409);
 const common={companyName:co!.company_name,representative:co!.representative,employeeName:v.name};
 const buffers=await Promise.all([
  renderEmploymentContractPdf({...payload,...common,companyAddress:co!.address,employmentType:c.employment_type}),
  renderNdaPdf({...common,kind:"new",pledgeDate:v.nda_agreed_at!.slice(0,10),address:v.address}),
  renderEmergencyContactPdf({...common,kind:"new",selfAddress:v.address,selfPhone:v.phone,ecName:v.emergency_name,ecRelationship:v.emergency_relation==="その他"?v.emergency_relation_other:v.emergency_relation,ecAddress:v.emergency_address,ecPhone:v.emergency_phone,submittedAt:new Date(v.submitted_at!)}),
 ]);
 return {files:buffers.map((b,i)=>({name:["雇用契約書.pdf","秘密保持誓約書.pdf","緊急連絡先.pdf"][i],data:Buffer.from(b).toString("base64")}))};
}
