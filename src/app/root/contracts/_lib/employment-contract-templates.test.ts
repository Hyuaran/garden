import {expect,it} from "vitest";
import {contractDefaults,defaultContractType,validateContract,type EmploymentContractPayload} from "./employment-contract";
import {employmentContractRows} from "./employment-contract-templates";
it.each([["アルバイト","part_time"],["正社員","full_time"],["派遣","nhk_dispatch"]])("defaults %s",(input,output)=>expect(defaultContractType(input)).toBe(output));
const base={kind:"new",contractStart:"2026-11-01",contractEnd:"2027-11-01",concludedOn:"2026-10-27",jobType:"sales",jobTypeOther:"",hourlyWage:300000,workLocation:"テスト勤務先",employeeAddress:"テスト住所"} as EmploymentContractPayload;
it.each([
 ["full_time", "有", "有"],
 ["nhk_dispatch", "無", "無"],
] as const)("prints only fixed choices for %s", (templateType, overtime, holidayWork) => {
 const rows=employmentContractRows({...base,...contractDefaults(templateType)});
 expect(rows[4].text.match(/所定外労働の有無（([^）]+)）/)?.[1]).toBe(overtime);
 expect(rows[4].text.match(/休日労働の有無（([^）]+)）/)?.[1]).toBe(holidayWork);
 for (const label of ["昇給", "賞与", "退職金"]) {
   const value=rows[6].text.match(new RegExp(`${label}\\s*（([^）]+)）`))?.[1];
   expect(value?.trim()).toMatch(/^無(?:\s+※.*)?$/);
   expect(value).not.toMatch(/有|[／/]/);
 }
 expect(rows[11].text.match(/雇用保険の適用\s*（([^）]+)）/)?.[1].trim()).toBe("有");
});
it.each(["full_time","nhk_dispatch"] as const)("inserts variables for %s",templateType=>{
 const p={...base,...contractDefaults(templateType),commuteCap:12345} as EmploymentContractPayload;
 expect(validateContract("e",p)).toBeNull();
 const rows=employmentContractRows(p);const text=rows.map(r=>r.text).join("");
 expect(rows).toHaveLength(12);expect(text).toContain("300,000円");expect(text).toContain("12,345円");expect(text).toContain("テスト勤務先");
 expect(text).not.toMatch(/桐井|山﨑|190,000|260,000|令和|株式会社ヒュアラン|株式会社リンクサポート|\?\?\?/);
 expect(validateContract("e",{...p,duties:""})).toBeTruthy();
 expect(validateContract("e",{...p,indefinite:true,contractEnd:""})).toBeNull();
 if(templateType==="nhk_dispatch") {expect(text).toContain("月60時間超");expect(text).toContain("65 歳");expect(text).toContain("労働基準法第２６条");expect(validateContract("e",{...p,startTime:""})).toBeTruthy();}
});
