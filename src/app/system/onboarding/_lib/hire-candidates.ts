
export const HIRE_FIELDS = ["last_name", "first_name", "last_name_kana", "first_name_kana", "birthday", "gender", "hire_date", "employment_type", "company_id", "kot_division_code", "kot_type_code"] as const;
export type HireInput = Record<typeof HIRE_FIELDS[number], string>;
export type HireCandidate = HireInput & HireChecklistState & { id: string; status: "planned" | "no_show" | "hiring" | "hired"; employee_number: string | null; employee_id: string | null; kintone_roster_record_id: string | null; steps: Record<string, { done?: boolean; at?: string; error?: string }> };
export const EMPLOYMENT_TYPES = ["正社員", "アルバイト", "役員", "派遣", "パートナー"];
export const CHECKLIST_KEYS = ["contract_sent", "contract_signed", "nda_sent", "nda_signed", "emergency_sent", "emergency_signed", "filemaker_added"] as const;
export const ALLOWED_CHECKLIST_KEYS = [...CHECKLIST_KEYS, "line_skipped"] as const;
export type ChecklistKey = typeof ALLOWED_CHECKLIST_KEYS[number];
export type HireChecklist = Partial<Record<ChecklistKey, { checked_at: string; checked_by: string }>>;
export type HireChecklistState = { checklist?: HireChecklist; onboarding_status?: string | null; line_registered?: boolean };
export function parseChecklist(raw: unknown): Partial<Record<ChecklistKey, boolean>> {
 if (!raw || typeof raw !== "object" || Array.isArray(raw) || !Object.keys(raw).length || Object.entries(raw).some(([key,value]) => !ALLOWED_CHECKLIST_KEYS.includes(key as ChecklistKey) || typeof value !== "boolean")) throw new Error("確認する項目を選び直してください");
 return raw as Partial<Record<ChecklistKey, boolean>>;
}
export function checklistComplete(row: HireChecklistState & {status: string}) {
 return row.status === "hired" && row.onboarding_status === "submitted" && (row.line_registered === true || (!!row.checklist?.line_skipped?.checked_at && !!row.checklist.line_skipped.checked_by)) && CHECKLIST_KEYS.every(key => !!row.checklist?.[key]?.checked_at && !!row.checklist[key]?.checked_by);
}
export function checklistPriority(row: HireChecklistState & {status: string}) {
 return row.status === "hired" && !checklistComplete(row) ? 0 : checklistComplete(row) ? 2 : 1;
}
export function parseHireInput(raw: unknown): HireInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("入力内容を確認してください");
  const input = Object.fromEntries(HIRE_FIELDS.map(k => [k, String((raw as Record<string, unknown>)[k] ?? "").trim()])) as HireInput;
  if (HIRE_FIELDS.some(k => !input[k] || input[k].length > 200)) throw new Error("入力内容を確認してください");
  for (const k of ["birthday", "hire_date"] as const) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input[k]) || new Date(input[k]).toISOString().slice(0,10) !== input[k]) throw new Error("入力内容を確認してください");
  }
  if (!["male", "female"].includes(input.gender) || !EMPLOYMENT_TYPES.includes(input.employment_type)) throw new Error("入力内容を確認してください");
  return input;
}
export function nextEmployeeNumber(numbers: (string | null)[], kotCodes: string[], reserved: (string | null)[] = []) {
  // 1900 未満のいちばん大きい番号＋1 から（1900〜1902 は付け間違いの飛び番・2026-10-24）。使用中の番号は飛ばす
  const valid = numbers.filter((n): n is string => !!n && /^\d+$/.test(n) && Number(n) < 9000);
  let number = Math.max(0, ...valid.map(Number).filter(n => n < 1900)) + 1;
  const occupied = new Set([...valid, ...kotCodes, ...reserved.filter((n): n is string => !!n)].filter(n => /^\d+$/.test(n)).map(Number));
  while (occupied.has(number) && number < 9000) number++;
  if (number >= 9000) throw new Error("入力内容を確認してください");
  return String(number);
}
export function rosterPayload(c: HireCandidate, companyName: string) {
 return Object.fromEntries(Object.entries({
 従業員名_姓: c.last_name, 従業員名_名: c.first_name,
 従業員名_姓名: c.last_name + " " + c.first_name, 従業員名_姓名カナ: c.last_name_kana + " " + c.first_name_kana,
 生年月日: c.birthday, 入社日: c.hire_date, 雇用形態: c.employment_type,
 社員番号: c.employee_number, 打刻ID: c.employee_number, 従業員ステータス: "在籍中", ドロップダウン_15: companyName,
 }).map(([k,value]) => [k,{value}]));
}
