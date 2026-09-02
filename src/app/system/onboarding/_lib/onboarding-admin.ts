import { commuteTotals, emptyInput, FIELD_LABELS, formatYen, HOUSEHOLDER_RELATION_OPTIONS, parseNullableAmount, STEP_FIELDS, type OnboardingInput, type TextField } from "./onboarding";

export const ADMIN_SELECT_OPTIONS = {
  insurance: ["加入", "未加入"],
  taxClass: ["甲", "乙"],
  salaryKind: ["月給", "日給", "時間給"],
} as const;

export const ADMIN_ALLOWANCE_LIMIT = 6;
export const ADMIN_COLUMNS = ["office", "weekly_hours", "health_insurance", "pension_insurance", "employment_insurance", "tax_class", "salary_kind", "base_salary", "allowances", "commute_fixed_monthly", "commute_cap_monthly", "admin_updated_at"] as const;

export type AdminAllowance = { name: string; amount: string };
export type AdminInput = {
  office: string;
  weekly_hours: string;
  health_insurance: string;
  pension_insurance: string;
  employment_insurance: string;
  tax_class: string;
  salary_kind: string;
  base_salary: string;
  allowances: AdminAllowance[];
  commute_fixed_monthly: string;
  commute_cap_monthly: string;
};
export type AdminEmployee = { employee_id: string; name: string | null; hire_date: string | null; birthday: string | null; company_id: string | null };
export type AdminOnboardingRecord = {
  employee: AdminEmployee;
  values: OnboardingInput;
  status: "draft" | "submitted";
  submittedAt: string | null;
  admin: AdminInput;
  adminUpdatedAt: string | null;
};
export type AdminListItem = {
  employeeId: string;
  name: string;
  hireDate: string | null;
  status: "draft" | "submitted";
  submittedAt: string | null;
  missingCount: number;
  adminComplete: boolean;
};

const MISSING_LABELS: Partial<Record<TextField, string>> = {
  emergency_name: "緊急連絡先の氏名",
  emergency_relation: "緊急連絡先の続柄",
  emergency_relation_other: "緊急連絡先の続柄（その他）",
  emergency_address: "緊急連絡先の住所",
  emergency_phone: "緊急連絡先の電話番号",
};

export function emptyAdminInput(): AdminInput {
  return { office: "", weekly_hours: "", health_insurance: "", pension_insurance: "", employment_insurance: "", tax_class: "", salary_kind: "", base_salary: "", allowances: [], commute_fixed_monthly: "", commute_cap_monthly: "" };
}

function text(value: unknown) {
  if (value == null) return "";
  if (typeof value !== "string" || value.length > 2000) throw new Error("invalid admin text");
  return value.trim();
}

function select(value: unknown, options: readonly string[]) {
  const trimmed = text(value);
  if (trimmed && !options.includes(trimmed)) throw new Error("invalid admin option");
  return trimmed;
}

function hasOwn(source: object, key: string) {
  return Object.prototype.hasOwnProperty.call(source, key);
}

export function parseAdminInput(value: unknown): AdminInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyAdminInput();
  const source = value as Record<string, unknown>;
  const allowancesSource = source.allowances;
  if (allowancesSource != null && (!Array.isArray(allowancesSource) || allowancesSource.length > ADMIN_ALLOWANCE_LIMIT)) throw new Error("invalid allowances");
  return {
    office: text(source.office),
    weekly_hours: text(source.weekly_hours),
    health_insurance: select(source.health_insurance, ADMIN_SELECT_OPTIONS.insurance),
    pension_insurance: select(source.pension_insurance, ADMIN_SELECT_OPTIONS.insurance),
    employment_insurance: select(source.employment_insurance, ADMIN_SELECT_OPTIONS.insurance),
    tax_class: select(source.tax_class, ADMIN_SELECT_OPTIONS.taxClass),
    salary_kind: select(source.salary_kind, ADMIN_SELECT_OPTIONS.salaryKind),
    base_salary: text(source.base_salary),
    allowances: ((allowancesSource as unknown[] | undefined) ?? []).map(item => {
      if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("invalid allowance");
      const row = item as Record<string, unknown>;
      const allowed = Object.keys(row).every(key => key === "name" || key === "amount");
      if (!allowed) throw new Error("invalid allowance key");
      return { name: text(row.name), amount: text(row.amount) };
    }),
    commute_fixed_monthly: text(source.commute_fixed_monthly),
    commute_cap_monthly: text(source.commute_cap_monthly),
  };
}

export function parseAdminEmailInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid email input");
  const source = value as Record<string, unknown>;
  return { email: text(source.email) };
}

export function parseAdminHouseholderInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid householder input");
  const source = value as Record<string, unknown>;
  const result: { householderName?: string; householderRelation?: string } = {};
  if (hasOwn(source, "householderName")) result.householderName = text(source.householderName);
  if (hasOwn(source, "householderRelation")) result.householderRelation = select(source.householderRelation, HOUSEHOLDER_RELATION_OPTIONS);
  if (!hasOwn(result, "householderName") && !hasOwn(result, "householderRelation")) throw new Error("empty householder input");
  return result;
}

export function adminInputFromRow(row: Record<string, unknown> | null, values: OnboardingInput): AdminInput;
export function adminInputFromRow(row: Record<string, unknown> | null): AdminInput;
export function adminInputFromRow(row: Record<string, unknown> | null): AdminInput {
  return parseAdminInput(row ?? {});
}

export function declaredCommutePassMonthly(values: Pick<OnboardingInput, "commute_routes">) {
  const total = commuteTotals(values.commute_routes).passMonthly;
  return total > 0 ? total : null;
}

export function formatDeclaredCommutePassMonthly(values: Pick<OnboardingInput, "commute_routes">) {
  const declared = declaredCommutePassMonthly(values);
  return declared == null ? "未入力" : formatYen(declared);
}

export function commutePaymentMonthly(values: Pick<OnboardingInput, "commute_routes">, capText: string) {
  const cap = parseNullableAmount(capText);
  if (cap == null) return "";
  const declared = declaredCommutePassMonthly(values);
  return String(declared == null ? cap : Math.min(declared, cap));
}

function missingTextFields(values: OnboardingInput) {
  const missing: string[] = [];
  const skip = new Set<TextField>();
  if (values.employment_insurance_status !== "yes") skip.add("employment_insurance_number");
  if (values.emergency_relation !== "その他") skip.add("emergency_relation_other");
  for (const fields of STEP_FIELDS) {
    for (const key of fields) {
      if (skip.has(key)) continue;
      if (!String(values[key] ?? "").trim()) missing.push(MISSING_LABELS[key] ?? FIELD_LABELS[key]);
    }
  }
  return missing;
}

export function missingOnboardingItems(values: OnboardingInput) {
  const missing = missingTextFields(values);
  values.dependents.forEach((dependent, index) => {
    for (const [key, label] of Object.entries({ name: "氏名", name_kana: "フリガナ", my_number: "マイナンバー（12桁）", relation: "続柄", birth_date: "生年月日", annual_income: "年間収入（円）", occupation: "職業または学校と学年" })) {
      if (!String(dependent[key as keyof typeof dependent] ?? "").trim()) missing.push(`扶養家族 ${index + 1}人目の${label}`);
    }
  });
  if (!values.commute_routes.length) missing.push("通勤区間");
  values.commute_routes.forEach((route, index) => {
    for (const [key, label] of Object.entries({ kind: "交通機関", from_station: "乗る駅・停留所", to_station: "降りる駅・停留所", line: "路線・系統", pass_monthly: "1か月の定期代（円）", fare_oneway: "片道の運賃（円）" })) {
      if (!String(route[key as keyof typeof route] ?? "").trim()) missing.push(`通勤 ${index + 1}区間目の${label}`);
    }
  });
  if (!values.nda_agreed) missing.push("秘密保持の確認");
  return missing;
}

export function adminIsComplete(admin: AdminInput) {
  return Boolean(admin.health_insurance && admin.pension_insurance && admin.employment_insurance && admin.tax_class && admin.salary_kind && admin.base_salary);
}

export function buildAdminList(records: AdminOnboardingRecord[]): AdminListItem[] {
  return records.map(record => ({
    employeeId: record.employee.employee_id,
    name: record.values.name.trim() || record.employee.name?.trim() || record.employee.employee_id,
    hireDate: record.employee.hire_date,
    status: record.status,
    submittedAt: record.submittedAt,
    missingCount: missingOnboardingItems(record.values).length,
    adminComplete: adminIsComplete(record.admin),
  })).sort((a, b) => {
    if (a.submittedAt && b.submittedAt) return b.submittedAt.localeCompare(a.submittedAt);
    if (a.submittedAt) return -1;
    if (b.submittedAt) return 1;
    return (b.hireDate ?? "").localeCompare(a.hireDate ?? "");
  });
}

export function initialAdminRecord(employeeId: string): AdminOnboardingRecord {
  return { employee: { employee_id: employeeId, name: null, hire_date: null, birthday: null, company_id: null }, values: emptyInput(), status: "draft", submittedAt: null, admin: emptyAdminInput(), adminUpdatedAt: null };
}
