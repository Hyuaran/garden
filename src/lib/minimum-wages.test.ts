import { afterEach, expect, it, vi } from "vitest";
import { minimumWageAt, wageError, hourlyEquivalent, missingCurrentWage, type MinimumWage } from "./minimum-wages";
const rows=[{prefecture:"大阪府",hourly_amount:1177,effective_from:"2025-10-16"},{prefecture:"大阪府",hourly_amount:1231,effective_from:"2026-10-01"}] as MinimumWage[];
afterEach(()=>vi.useRealTimers());
it("selects the rate in effect on the contract date",()=>{
 expect(minimumWageAt(rows,"大阪府","2026-09-30")?.hourly_amount).toBe(1177);
 expect(minimumWageAt(rows,"大阪府","2026-10-01")?.hourly_amount).toBe(1231);
 expect(minimumWageAt(rows,"大阪府","2025-01-01")).toBeNull();
});
it("rejects missing and insufficient wages",()=>{
 expect(wageError({contractStart:"2026-10-01",hourlyWage:1230},rows)).toContain("1,231 円");
 expect(wageError({contractStart:"2025-01-01",hourlyWage:2000},rows)).toBe("最低賃金マスタに登録がありません");
 expect(wageError({contractStart:"2026-10-01",hourlyWage:1231},rows)).toBeNull();
});
it("checks monthly salary using weekly hours without rounding the comparison",()=>{
 expect(Math.round(hourlyEquivalent(100000,15))).toBe(1538);
 expect(wageError({contractStart:"2026-10-01",hourlyWage:100000,salaryKind:"monthly",weeklyHours:15},rows)).toBeNull();
 expect(wageError({contractStart:"2026-10-01",hourlyWage:70000,salaryKind:"monthly",weeklyHours:15},rows)).toContain("下回っています");
 expect(wageError({contractStart:"2026-10-01",hourlyWage:100000,salaryKind:"monthly"},rows)).toBe("週の所定時間を入れてください");
});
it("warns from October 1 in Japan only when this year's row is absent",()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date("2026-09-30T14:59:59Z"));expect(missingCurrentWage(rows.slice(0,1))).toBe(false);
 vi.setSystemTime(new Date("2026-09-30T15:00:00Z"));expect(missingCurrentWage(rows.slice(0,1))).toBe(true);expect(missingCurrentWage(rows)).toBe(false);
});
