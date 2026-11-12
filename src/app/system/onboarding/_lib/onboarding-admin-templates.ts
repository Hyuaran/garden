import { emptyAdminInput, parseAdminInput, type AdminInput } from "./onboarding-admin";

export const TEMPLATE_FIELDS = ["office", "weekly_hours", "health_insurance", "pension_insurance", "employment_insurance", "tax_class", "salary_kind", "base_salary", "allowances", "commute_cap_monthly"] as const;
export type TemplateValues = Partial<Pick<AdminInput, typeof TEMPLATE_FIELDS[number]>>;
export type AdminTemplate = { id: string; name: string; sort_order: number; values: TemplateValues; updated_at: string };

export function parseTemplateValues(raw: unknown): TemplateValues {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("ひな形の値を確認してください");
  if (Object.keys(raw).some(key => !TEMPLATE_FIELDS.includes(key as typeof TEMPLATE_FIELDS[number]))) throw new Error("ひな形の項目を確認してください");
  const parsed = parseAdminInput(raw);
  return Object.fromEntries(TEMPLATE_FIELDS.filter(key => Object.hasOwn(raw, key)).map(key => [key, parsed[key]]));
}

export function templatePatch(values: TemplateValues): TemplateValues {
  // 空のテレマひな形は何も変更しない。手当なし（[]）は明示的な値。
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ""));
}

export function templateOverwrites(current: AdminInput, values: TemplateValues) {
  const empty = emptyAdminInput();
  return Object.entries(templatePatch(values)).some(([key, value]) => {
    const previous = current[key as keyof AdminInput];
    return JSON.stringify(previous) !== JSON.stringify(empty[key as keyof AdminInput]) && JSON.stringify(previous) !== JSON.stringify(value);
  });
}
