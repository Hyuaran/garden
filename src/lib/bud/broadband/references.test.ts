import { it,expect } from "vitest";
import { nttReference,isK } from "./references";
import { cellTone, type TableRecord } from "./table";
import type { Bank } from "./reconcile";
it("takes all phone numbers from the 20th through next month's 10th, by corporation and expense",()=>{
 const b=(date:string,corp_code="HR",content="電話料 123",side="EXPENSE")=>({date,corp_code,content,side,value:100} as Bank);
 const bank=[b("2026-10-19"),b("2026-10-20"),b("2026-11-01","HR","電話料 999"),b("2026-11-10"),b("2026-11-11"),b("2026-10-26","CR","ゼイキントウ"),b("2026-10-26","HR","電話料","INCOME")];
 expect(nttReference("2026-10",false,bank)).toHaveLength(3);
 expect(nttReference("2026-10",true,bank)).toHaveLength(1);
 for(const partner of ["NTT原価（東）","関電経費合計","決済費用（壱）"]) expect(cellTone([{partner,recon_status:"amount_mismatch"} as TableRecord])).toBe("normal");
 expect(isK("関電経費合計")).toBe(true);
});
