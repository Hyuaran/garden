
export const HIRE_FIELDS = ["last_name", "first_name", "last_name_kana", "first_name_kana", "birthday", "gender", "hire_date", "employment_type", "company_id", "kot_division_code", "kot_type_code"] as const;
export type HireInput = Record<typeof HIRE_FIELDS[number], string> & { haken_party_id?: string; haken_period_end?: string; haken_issue_batch_id?: string };
export type HireCandidate = HireInput & HireChecklistState & { id: string; status: "planned" | "no_show" | "hiring" | "hired"; employee_number: string | null; employee_id: string | null; kintone_roster_record_id: string | null; steps: Record<string, { done?: boolean; at?: string; error?: string }> };
export const EMPLOYMENT_TYPES = ["正社員", "アルバイト", "役員", "派遣", "パートナー"];
export const CHECKLIST_KEYS = ["contract_sent", "contract_signed", "nda_sent", "nda_signed", "emergency_sent", "emergency_signed", "filemaker_added"] as const;
export const ALLOWED_CHECKLIST_KEYS = [...CHECKLIST_KEYS, "contract_not_required", "nda_not_required", "emergency_not_required", "line_skipped"] as const;
export type ChecklistKey = typeof ALLOWED_CHECKLIST_KEYS[number];
export type HireChecklist = Partial<Record<ChecklistKey, { checked_at: string; checked_by: string }>>;
export type HireChecklistState = { employment_type?: string | null; line_verified?: boolean; line_verified_at?: string | null; line_verified_by?: string | null; line_display_renamed_at?: string | null; line_display_renamed_by?: string | null; filemaker_request?: {status:string;files:Record<string,{status:string;error?:string}>}|null; checklist?: HireChecklist; onboarding_status?: string | null; line_registered?: boolean };
export function parseChecklist(raw: unknown): Partial<Record<ChecklistKey, boolean>> {
 if (!raw || typeof raw !== "object" || Array.isArray(raw) || !Object.keys(raw).length || Object.entries(raw).some(([key,value]) => !ALLOWED_CHECKLIST_KEYS.includes(key as ChecklistKey) || typeof value !== "boolean")) throw new Error("確認する項目を選び直してください");
 return raw as Partial<Record<ChecklistKey, boolean>>;
}
export function checklistComplete(row: HireChecklistState & {status: string}) {
 return row.status === "hired" && row.onboarding_status === "submitted" && lineComplete(row) && signaturesComplete(row) && (row.employment_type === "派遣" || SIGNATURE_GROUPS.every(key => !!row.checklist?.[`${key}_not_required`]?.checked_at || (!!row.checklist?.[`${key}_sent`]?.checked_at && !!row.checklist?.[`${key}_sent`]?.checked_by))) && !!row.checklist?.filemaker_added?.checked_at && !!row.checklist.filemaker_added.checked_by;
}
export function checklistPriority(row: HireChecklistState & {status: string}) {
 return row.status === "hired" && !checklistComplete(row) ? 0 : checklistComplete(row) ? 2 : 1;
}
export function parseHireInput(raw: unknown): HireInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("入力内容を確認してください");
  const input = Object.fromEntries(HIRE_FIELDS.map(k => [k, String((raw as Record<string, unknown>)[k] ?? "").trim()])) as HireInput;
  if (HIRE_FIELDS.some(k => (isHireFieldRequired(k,input.employment_type) && !input[k]) || input[k].length > 200)) throw new Error("入力内容を確認してください");
  for (const k of ["birthday", "hire_date"] as const) {
    if (!input[k] && k === "birthday" && input.employment_type === "派遣") continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input[k]) || new Date(input[k]).toISOString().slice(0,10) !== input[k]) throw new Error("入力内容を確認してください");
  }
  if (!["male", "female", ...(input.employment_type === "派遣" ? [""] : [])].includes(input.gender) || !EMPLOYMENT_TYPES.includes(input.employment_type)) throw new Error("入力内容を確認してください");
  if (input.employment_type === "派遣") {
    const source = raw as Record<string, unknown>;
    if (source.haken_issue_batch_id) {
      input.haken_issue_batch_id = String(source.haken_issue_batch_id);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.haken_issue_batch_id)) throw new Error("書類の発行情報を確認してください");
    }
    input.haken_party_id = String(source.haken_party_id ?? "").trim();
    input.haken_period_end = String(source.haken_period_end ?? "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.haken_party_id) || !/^\d{4}-\d{2}-\d{2}$/.test(input.haken_period_end)) throw new Error("派遣会社と終了日を入力してください");
    const end = new Date(input.haken_period_end);
    if (!Number.isFinite(end.getTime()) || end.toISOString().slice(0, 10) !== input.haken_period_end || input.haken_period_end < input.hire_date) throw new Error("派遣期間の終了日を確認してください");
  }
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
// Kintone 名簿の会社の選択肢は「ヒュアラン」のように「株式会社」なし（Root の法人名は「株式会社ヒュアラン」）
export const rosterCompanyName = (name: string) => name.replace(/^(株式会社|（株）|\(株\))\s*/, "").replace(/\s*(株式会社)$/, "").trim();
export function rosterPayload(c: HireCandidate, companyName: string) {
 return Object.fromEntries(Object.entries({
 従業員名_姓: c.last_name, 従業員名_名: c.first_name || "",
 従業員名_姓名: [c.last_name,c.first_name].filter(Boolean).join(" "), 従業員名_姓名カナ: [c.last_name_kana,c.first_name_kana].filter(Boolean).join(" "),
 生年月日: c.birthday || "", 入社日: c.hire_date, 雇用形態: c.employment_type,
 社員番号: c.employee_number, 打刻ID: c.employee_number, 従業員ステータス: "在籍中", ドロップダウン_15: rosterCompanyName(companyName),
 }).map(([k,value]) => [k,{value}]));
}

export const SIGNATURE_GROUPS = ["contract","nda","emergency"] as const;
export function signatureCount(row: HireChecklistState) {
 if (row.employment_type === "派遣") return 3;
 return SIGNATURE_GROUPS.filter(key => [row.checklist?.[`${key}_signed`],row.checklist?.[`${key}_not_required`]].some(value => !!value?.checked_at && !!value.checked_by)).length;
}
export function signaturesComplete(row: HireChecklistState) { return signatureCount(row) === 3; }
export function isHireFieldRequired(key: keyof HireInput, employmentType: string) {
 if (key === "haken_party_id" || key === "haken_period_end") return employmentType === "派遣";
 return employmentType !== "派遣" || !["first_name","first_name_kana","birthday","gender"].includes(key);
}
export function hireInformationPending(row: HireInput) {
 return row.employment_type === "派遣" && [row.first_name,row.first_name_kana,row.birthday,row.gender].some(value => !value);
}
export function lineComplete(row: HireChecklistState) { return (!!row.line_verified_at && !!row.line_display_renamed_at) || (!!row.checklist?.line_skipped?.checked_at && !!row.checklist.line_skipped.checked_by); }
