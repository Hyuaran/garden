export const PREPARING_MESSAGE = "入社手続きの準備がまだできていません。管理者へお問い合わせください。";
export const POSTAL_NOT_FOUND = "郵便番号に合う住所が見つかりませんでした。住所を直接入れてください";
export const STEPS = ["あなたのこと", "住所と連絡先", "ご家族", "年金と雇用保険", "直近の勤務先", "緊急連絡先", "秘密保持の確認", "確認"] as const;

export const TEXT_FIELDS = ["name", "name_kana", "gender", "birth_date", "postal_code", "address", "address_kana", "phone", "pension_number", "employment_insurance_status", "employment_insurance_number", "previous_employer", "previous_employer_from", "previous_employer_to", "emergency_name", "emergency_relation", "emergency_address", "emergency_phone"] as const;
export type TextField = typeof TEXT_FIELDS[number];
export const DEPENDENT_FIELDS = ["name", "name_kana", "relation", "birth_date", "annual_income", "occupation"] as const;
export type Dependent = Record<typeof DEPENDENT_FIELDS[number], string>;
export type OnboardingInput = Record<TextField, string> & { dependents: Dependent[]; nda_agreed: boolean };
export type OnboardingRecord = { values: OnboardingInput; status: "draft" | "submitted"; ndaAgreedAt: string | null; submittedAt: string | null };
export const emptyDependent = (): Dependent => ({ name: "", name_kana: "", relation: "", birth_date: "", annual_income: "", occupation: "" });
export function emptyInput(): OnboardingInput {
  return { ...Object.fromEntries(TEXT_FIELDS.map(key => [key, ""])) as Record<TextField, string>, dependents: [], nda_agreed: false };
}

// 保存対象を明示する。社員ID・状態・日時や任意の追加項目は入力から受け取らない。
export function parseInput(value: unknown): OnboardingInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid input");
  const source = value as Record<string, unknown>;
  const result = emptyInput();
  for (const key of TEXT_FIELDS) {
    if (source[key] != null && (typeof source[key] !== "string" || source[key].length > 2000)) throw new Error("invalid text");
    result[key] = typeof source[key] === "string" ? source[key].trim() : "";
  }
  if (source.dependents != null && (!Array.isArray(source.dependents) || source.dependents.length > 30)) throw new Error("invalid dependents");
  result.dependents = (source.dependents as unknown[] | undefined ?? []).map(item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("invalid dependent");
    const row = item as Record<string, unknown>;
    return Object.fromEntries(DEPENDENT_FIELDS.map(key => {
      if (row[key] != null && (typeof row[key] !== "string" || row[key].length > 2000)) throw new Error("invalid dependent text");
      return [key, typeof row[key] === "string" ? row[key].trim() : ""];
    })) as Dependent;
  });
  result.nda_agreed = source.nda_agreed === true;
  return result;
}

export function initialInput(employee: { name?: unknown; name_kana?: unknown; birthday?: unknown }) {
  return { ...emptyInput(), name: String(employee.name ?? ""), name_kana: String(employee.name_kana ?? ""), birth_date: String(employee.birthday ?? "") };
}

export function formatWarnings(values: OnboardingInput) {
  const warnings: Partial<Record<TextField, string>> = {};
  for (const [key, length, label] of [["postal_code", 7, "郵便番号"], ["pension_number", 10, "基礎年金番号"], ["employment_insurance_number", 11, "雇用保険被保険者番号"]] as const) {
    if (key === "employment_insurance_number" && values.employment_insurance_status !== "yes") continue;
    if (values[key] && !new RegExp(`^[0-9]{${length}}$`).test(values[key])) warnings[key] = `${label}は${length}桁の数字です。分かる範囲で確認してください。このまま進めます。`;
  }
  for (const key of ["phone", "emergency_phone"] as const) if (values[key] && !/^[0-9-]+$/.test(values[key])) warnings[key] = "電話番号は数字とハイフンで入力してください。このまま進めます。";
  return warnings;
}

export const FIELD_LABELS: Record<TextField, string> = {
  name: "氏名", name_kana: "フリガナ", gender: "性別", birth_date: "生年月日", postal_code: "郵便番号", address: "住所", address_kana: "住所のフリガナ", phone: "電話番号",
  pension_number: "基礎年金番号", employment_insurance_status: "雇用保険被保険者証", employment_insurance_number: "雇用保険被保険者番号", previous_employer: "会社名", previous_employer_from: "勤務した期間（開始）", previous_employer_to: "勤務した期間（終了）", emergency_name: "氏名", emergency_relation: "続柄", emergency_address: "住所", emergency_phone: "電話番号",
};
export const DEPENDENT_LABELS: Record<typeof DEPENDENT_FIELDS[number], string> = { name: "氏名", name_kana: "フリガナ", relation: "続柄", birth_date: "生年月日", annual_income: "年間収入（円）", occupation: "職業または学校と学年" };
export const STEP_FIELDS: readonly (readonly TextField[])[] = [
  ["name", "name_kana", "gender", "birth_date"], ["postal_code", "address", "address_kana", "phone"], [],
  ["pension_number", "employment_insurance_status", "employment_insurance_number"], ["previous_employer", "previous_employer_from", "previous_employer_to"],
  ["emergency_name", "emergency_relation", "emergency_address", "emergency_phone"], [],
];
export function displayValue(key: TextField, value: string) {
  return key === "employment_insurance_status" ? ({ yes: "あり", no: "なし", unknown: "わからない" }[value] ?? value) : value;
}
