export type Corp = {
  id: string;
  name_short: string | null;
  established_on?: string | null;
  fiscal_end_month?: number | null;
};
export type Employee = { employee_id: string; company_id: string | null; name: string | null; expense_default_corp_id?: string | null };
export type Company = { company_id: string; company_name: string | null };
export type ExpenseCorpRow = {
  corp_id: string | null;
  applicant_employee_id: string | null;
};

export const FALLBACK_CORPS: Corp[] = [
  { id: "hyuaran", name_short: "ヒュアラン" },
  { id: "centerrise", name_short: "センターライズ" },
  { id: "linksupport", name_short: "リンクサポート" },
  { id: "arata", name_short: "ARATA" },
  { id: "taiyou", name_short: "たいよう" },
  { id: "ichi", name_short: "壱" },
  { id: "stonebase", name_short: "ストーンベース" },
];

const CORP_ORDER = FALLBACK_CORPS.map((corp) => corp.id);

export function sortCorps(corps: Corp[]) {
  const source = corps.length > 0 ? corps : FALLBACK_CORPS;
  return [...source].sort((a, b) => {
    const ai = CORP_ORDER.indexOf(a.id);
    const bi = CORP_ORDER.indexOf(b.id);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    return (a.name_short ?? a.id).localeCompare(b.name_short ?? b.id, "ja");
  });
}

export function buildCompanyToCorp(companies: Company[], corps: Corp[]) {
  const map: Record<string, string> = {};
  for (const company of companies) {
    const name = company.company_name ?? "";
    const hit = corps.find((corp) => corp.name_short && name.includes(corp.name_short));
    if (hit) map[company.company_id] = hit.id;
  }
  return map;
}

export function getEffectiveCorpId(
  row: ExpenseCorpRow,
  employees: Record<string, Employee>,
  companyToCorp: Record<string, string>,
) {
  if (row.corp_id) return row.corp_id;
  const employee = row.applicant_employee_id ? employees[row.applicant_employee_id] : null;
  if (employee?.expense_default_corp_id) return employee.expense_default_corp_id;
  const companyId = employee?.company_id ?? null;
  if (!companyId) return null;
  return companyToCorp[companyId] ?? companyId;
}
