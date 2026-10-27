import { expect, it } from "vitest";
import { contractEndDate, initializeContract, japanToday, updateContract, normalizeRenewal } from "./hire-contract-defaults";
it.each([
 ["full_time","2026-10-05","2026-12-31"], ["nhk_dispatch","2026-11-01","2027-01-31"],
 ["full_time","2026-12-15","2027-02-28"], ["full_time","2027-12-15","2028-02-29"],
 ["part_time","2026-10-05","2026-10-31"],
] as const)("calculates %s from %s",(templateType,contractStart,end)=>expect(contractEndDate({templateType,contractStart},"2026-10-28")).toBe(end));
it("uses Japan date and fills only empty dates",()=>{
 const today=japanToday(new Date("2026-10-27T15:01:00Z"));expect(today).toBe("2026-10-28");
 expect(initializeContract({templateType:"part_time"},today)).toMatchObject({concludedOn:today,contractEnd:"2026-10-31"});
 expect(initializeContract({concludedOn:"2025-01-01",contractEnd:"2027-03-31"},today)).toMatchObject({concludedOn:"2025-01-01",contractEnd:"2027-03-31"});
});
it("updates automatic dates, preserves manual dates and clears indefinite dates",()=>{
 const p={templateType:"full_time" as const,contractStart:"2026-11-01",contractEnd:"2026-12-31"};
 expect(updateContract(p,"2026-10-28",true).contractEnd).toBe("2027-01-31");
 expect(updateContract(p,"2026-10-28",false).contractEnd).toBe("2026-12-31");
 expect(updateContract({...p,indefinite:true},"2026-10-28",false).contractEnd).toBe("");
});
it("normalizes legacy renewal wording",()=>expect(normalizeRenewal("更新する場合がある")).toBe("更新する場合があり得る"));
