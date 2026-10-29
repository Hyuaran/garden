import { isEmployeeActive, type EmployeeAccessRow } from "@/lib/auth/employee-access";
export type NotifyEmployee = EmployeeAccessRow & { employee_id: string; name: string; chatwork_account_id: string | null };
export type NotifyState = { employees: { value: string; label: string }[]; recipients: Record<string, string[]> };
export function eligibleEmployee(e: NotifyEmployee) { return e.is_active === true && isEmployeeActive(e) && Boolean(e.chatwork_account_id?.trim()); }
export function mentionsFor(ids: string[], employees: NotifyEmployee[]) {
 const byId = new Map(employees.filter(eligibleEmployee).map(e => [e.employee_id,e]));
 return ids.flatMap(id => { const e=byId.get(id); return e ? [{id:e.chatwork_account_id!.trim(),name:e.name+"さん"}] : []; });
}
