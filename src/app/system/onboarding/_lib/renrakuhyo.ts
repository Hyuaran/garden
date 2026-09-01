import { commuteTotals, parseAmount, type OnboardingInput } from "./onboarding";
import type { AdminInput, AdminOnboardingRecord } from "./onboarding-admin";
import { toWarekiDate } from "./fuyou-pdf";

export type RenrakuhyoCompany = {
  company_name: string;
};

export type RenrakuhyoValues = {
  company_name: string;
  kana: string;
  gender: string;
  name: string;
  birth: string;
  addr_kana: string;
  zip: string;
  tel: string;
  address: string;
  hire: string;
  office: string;
  insurance: string;
  pension: string;
  mynumber: string;
  koyou_card: string;
  koyou_no: string;
  prev_company: string;
  prev_period: string;
  total_pay: string;
  pay_kind: string;
  base_pay: string;
  commute_pass: string;
  commute_round: string;
  tax: string;
  weekly: string;
};

export const RENRAKUHYO_EXCEL_CELLS: Record<keyof RenrakuhyoValues, string> = {
  company_name: "C5",
  kana: "D7",
  gender: "H7",
  name: "D8",
  birth: "H8",
  addr_kana: "D9",
  zip: "E10",
  tel: "H10",
  address: "D11",
  hire: "E12",
  office: "H12",
  insurance: "E29",
  pension: "D30",
  mynumber: "D31",
  koyou_card: "D32",
  koyou_no: "F33",
  prev_company: "D36",
  prev_period: "G36",
  total_pay: "F37",
  pay_kind: "D38",
  base_pay: "G38",
  commute_pass: "G45",
  commute_round: "G46",
  tax: "C48",
  weekly: "H51",
};

export const RENRAKUHYO_PDF_FIELDS: Array<{ key: keyof RenrakuhyoValues; x: number; y: number; align: "left" | "center" }> = [
  { key: "company_name", x: 85.1, y: 100.1, align: "left" },
  { key: "kana", x: 131.3, y: 117.9, align: "left" },
  { key: "gender", x: 374.6, y: 117.4, align: "left" },
  { key: "name", x: 131.7, y: 140.3, align: "left" },
  { key: "birth", x: 374.6, y: 139.1, align: "left" },
  { key: "addr_kana", x: 121.2, y: 161.3, align: "left" },
  { key: "zip", x: 163.9, y: 173.7, align: "left" },
  { key: "tel", x: 374.6, y: 173.1, align: "left" },
  { key: "address", x: 131.3, y: 189.9, align: "left" },
  { key: "hire", x: 163.9, y: 210.3, align: "left" },
  { key: "office", x: 374.6, y: 210.3, align: "left" },
  { key: "insurance", x: 163.9, y: 443.0, align: "left" },
  { key: "pension", x: 121.1, y: 458.7, align: "left" },
  { key: "mynumber", x: 121.1, y: 475.3, align: "left" },
  { key: "koyou_card", x: 131.3, y: 492.3, align: "left" },
  { key: "koyou_no", x: 251.1, y: 509.2, align: "left" },
  { key: "prev_company", x: 131.3, y: 553.0, align: "left" },
  { key: "prev_period", x: 296.5, y: 553.0, align: "left" },
  { key: "total_pay", x: 251.0, y: 571.4, align: "left" },
  { key: "pay_kind", x: 131.3, y: 589.6, align: "left" },
  { key: "base_pay", x: 330.4, y: 589.6, align: "left" },
  { key: "commute_pass", x: 330.4, y: 693.8, align: "left" },
  { key: "commute_round", x: 330.4, y: 708.7, align: "left" },
  { key: "tax", x: 297.6, y: 737.5, align: "center" },
  { key: "weekly", x: 388.5, y: 783.4, align: "center" },
];

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function dashed(value: string, groups: number[]) {
  const onlyDigits = digits(value);
  if (onlyDigits.length !== groups.reduce((sum, group) => sum + group, 0)) return value;
  let offset = 0;
  return groups.map(group => {
    const part = onlyDigits.slice(offset, offset + group);
    offset += group;
    return part;
  }).join("-");
}

function ymd(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

export function formatPlainJapaneseDate(value: string) {
  const parsed = ymd(value);
  return parsed ? `${parsed.year}年${parsed.month}月${parsed.day}日` : "";
}

export function formatWarekiHireDate(value: string | null) {
  if (!value) return "";
  const wareki = toWarekiDate(value);
  if (!wareki) return "";
  const era = { 明: "明治", 大: "大正", 昭: "昭和", 平: "平成", 令: "令和" }[wareki.era];
  return `${era} ${wareki.year}年　${wareki.month}　月　${wareki.day}　日`;
}

export function formatPostalCode(value: string) {
  return dashed(value, [3, 4]);
}

export function formatPhone(value: string) {
  return dashed(value, [3, 4, 4]);
}

export function formatPensionNumber(value: string) {
  return dashed(value, [4, 6]);
}

export function formatMyNumber(value: string) {
  return dashed(value, [4, 4, 4]);
}

export function formatEmploymentInsuranceNumber(value: string) {
  return dashed(value, [4, 6, 1]);
}

function commaAmount(value: string) {
  const amount = parseAmount(value);
  return amount > 0 ? amount.toLocaleString("ja-JP") : "";
}

function insuranceStatus(admin: AdminInput) {
  const entries = [
    { status: admin.health_insurance, label: "健康保険" },
    { status: admin.pension_insurance, label: "厚生年金" },
    { status: admin.employment_insurance, label: "雇用保険" },
  ];
  if (entries.every(entry => entry.status === "加入")) return "すべて加入";
  const joined = entries.filter(entry => entry.status === "加入").map(entry => entry.label);
  if (joined.length) return `${joined.join("・")}に加入`;
  if (entries.every(entry => entry.status === "未加入")) return "加入なし";
  return "";
}

function employmentCardStatus(value: string) {
  if (value === "yes") return "(保険者証 )   有り";
  if (value === "no") return "(保険者証 )   無し";
  return "";
}

function previousPeriod(values: Pick<OnboardingInput, "previous_employer_from" | "previous_employer_to">) {
  const from = ymd(values.previous_employer_from);
  const to = ymd(values.previous_employer_to);
  if (!from || !to) return "";
  return `${from.year}　年　${from.month}　月　～　${to.year}　年　${to.month}　月`;
}

function totalPay(admin: AdminInput) {
  const total = parseAmount(admin.base_salary) + admin.allowances.reduce((sum, allowance) => sum + parseAmount(allowance.amount), 0);
  return total > 0 ? total.toLocaleString("ja-JP") : "";
}

// 会社が出す1か月の交通費。事務が確定額を入れていればそれ、入れていなければ上限と本人申告の小さいほう。
// 事務がどちらも入れていないときは空欄にする（本人申告額をそのまま出すと、
// 上限で減額される場合に違う金額のまま社労士へ渡ってしまうため）。
function commutePass(values: Pick<OnboardingInput, "commute_routes">, admin: Pick<AdminInput, "commute_fixed_monthly" | "commute_cap_monthly">) {
  const fixed = parseAmount(admin.commute_fixed_monthly);
  if (fixed > 0) return fixed.toLocaleString("ja-JP");
  const cap = parseAmount(admin.commute_cap_monthly);
  if (cap <= 0) return "";
  const declared = commuteTotals(values.commute_routes).passMonthly;
  const paid = declared > 0 ? Math.min(declared, cap) : cap;
  return paid.toLocaleString("ja-JP");
}

function commuteRound(values: Pick<OnboardingInput, "commute_routes">, admin: Pick<AdminInput, "commute_fixed_monthly" | "commute_cap_monthly">) {
  if (commutePass(values, admin)) return "";
  const total = commuteTotals(values.commute_routes).fareOneway;
  return total > 0 ? (total * 2).toLocaleString("ja-JP") : "";
}

function taxClass(value: string) {
  if (value === "甲") return "税区分　：　甲（扶養控除等異動申告書の提出あり）";
  if (value === "乙") return "税区分　：　乙（提出なし）";
  return "";
}

export function renrakuhyoBaseName(record: AdminOnboardingRecord) {
  const label = (record.values.name_kana || record.values.name || record.employee.employee_id).replace(/[\s　]+/g, "");
  return `01【提出用${label}】TLCC様入社連絡表`;
}

export function buildRenrakuhyoValues(record: AdminOnboardingRecord, company: RenrakuhyoCompany): RenrakuhyoValues {
  const values = record.values;
  const admin = record.admin;
  return {
    company_name: company.company_name ? `会社名        ${company.company_name}` : "",
    kana: values.name_kana,
    gender: values.gender === "女性" ? "　　女" : values.gender === "男性" ? "　　男" : "",
    name: values.name,
    birth: formatPlainJapaneseDate(values.birth_date),
    addr_kana: values.address_kana,
    zip: formatPostalCode(values.postal_code),
    tel: formatPhone(values.phone),
    address: values.address,
    hire: formatWarekiHireDate(record.employee.hire_date),
    office: admin.office,
    insurance: `厚生年金　・　健康保険　・　　雇用保険　　　${insuranceStatus(admin)}`,
    pension: values.pension_number ? `基礎年金番号※10桁：　${formatPensionNumber(values.pension_number)}` : "",
    mynumber: values.my_number ? ` マイナンバー※12桁：  ${formatMyNumber(values.my_number)}` : "",
    koyou_card: employmentCardStatus(values.employment_insurance_status),
    koyou_no: formatEmploymentInsuranceNumber(values.employment_insurance_number),
    prev_company: values.previous_employer,
    prev_period: previousPeriod(values),
    total_pay: totalPay(admin),
    pay_kind: admin.salary_kind,
    base_pay: commaAmount(admin.base_salary),
    commute_pass: commutePass(values, admin),
    commute_round: commuteRound(values, admin),
    tax: taxClass(admin.tax_class),
    weekly: admin.weekly_hours,
  };
}

export function safeRenrakuhyoErrorMessage(status: number) {
  if (status === 401) return "ログインし直してください。";
  if (status === 403) return "この書類を作れる権限がありません。責任者へ依頼してください。";
  if (status === 404) return "入社手続きの入力が見つかりませんでした。";
  if (status === 409) return "入社連絡表を作るための情報が不足しています。入力内容を確認してください。";
  if (status === 503) return "保存先のフォルダに書き込めませんでした。";
  return "保存先のフォルダに書き込めませんでした。";
}
