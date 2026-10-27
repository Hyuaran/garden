import type { EmploymentContractPayload } from "@/app/root/contracts/_lib/employment-contract";
type Contract = Partial<EmploymentContractPayload>;
export const RENEWAL_OPTIONS = ["自動的に更新する", "更新する場合があり得る", "契約の更新はしない", "その他"] as const;
export function normalizeRenewal(value?: string) {
 return !value || value === "更新する場合がある" ? RENEWAL_OPTIONS[1] : value;
}
export function japanToday(now: Date) {
 return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function contractEndDate(p: Contract, today: string) {
 if (p.indefinite) return "";
 const [year, month] = (p.contractStart || today).split("-").map(Number);
 return new Date(Date.UTC(year, month - 1 + (p.templateType === "part_time" ? 1 : 3), 0)).toISOString().slice(0, 10);
}
export function initializeContract(p: Contract, today: string) {
 return {...p, concludedOn: p.concludedOn || today, contractEnd: p.indefinite ? "" : p.contractEnd || contractEndDate(p, today), renewalText: normalizeRenewal(p.renewalText)};
}
export function updateContract(p: Contract, today: string, automaticEnd: boolean): Contract {
 return {...p, contractEnd: p.indefinite ? "" : automaticEnd ? contractEndDate(p, today) : p.contractEnd, renewalText: normalizeRenewal(p.renewalText)};
}
