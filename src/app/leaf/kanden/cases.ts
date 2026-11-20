export const CASE_TABS = [
  { key: "active", label: "進行中" },
  { key: "completed", label: "完了" },
  { key: "cancelled", label: "キャンセル" },
] as const;

export type CaseTab = typeof CASE_TABS[number]["key"];

export type CaseRow = {
  id: string;
  kanri_no: string | null;
  kanri_no_raw: string | null;
  ordered_on: string;
  customer_name: string | null;
  customer_kana: string | null;
  address: string | null;
  acquisition: string | null;
  contract_type: string | null;
  progress: string | null;
  entered_on: string | null;
  app_sent_on: string | null;
  invoice_sent_on: string | null;
  sales_name: string | null;
  clerk_name: string | null;
  photo_count: number;
};

export type CaseList = {
  hasOrders: boolean;
  updatedAt: string | null;
  years: number[];
  counts: Record<CaseTab, number>;
  rows: CaseRow[];
};

export function caseTab(value: unknown): CaseTab {
  return CASE_TABS.find(tab => tab.key === value)?.key ?? "active";
}

export function fiscalYear(today: Date) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "numeric",
  }).formatToParts(today);
  const year = Number(parts.find(part => part.type === "year")?.value);
  const month = Number(parts.find(part => part.type === "month")?.value);
  return month < 4 ? year - 1 : year;
}

export function caseListHref(year: number, tab: CaseTab, search = "") {
  const query = new URLSearchParams({ year: String(year), tab });
  if (search) query.set("q", search);
  return `/leaf/kanden?${query}`;
}

export const DETAIL_ORDER_FIELDS = [
  ["ordered_on", "受注日"], ["entered_on", "エントリー日"], ["specs_on", "諸元回収日"],
  ["app_sent_on", "申込送付日"], ["invoice_sent_on", "請求送付日"], ["payment_confirmed", "入金確認"],
  ["cancelled_on", "取消日"], ["progress", "進捗"], ["acquisition", "区分"],
  ["acquisition_method", "獲得手法"], ["contract_type", "契約種別"], ["power_apply", "動力申込"],
  ["plan", "申込プラン"], ["billing_amount", "請求金額"], ["sales_name", "受注者"], ["clerk_name", "事務担当"],
] as const;

export const DETAIL_CUSTOMER_FIELDS = [
  ["customer_name", "お客様名"], ["customer_kana", "お客様名（カナ）"], ["address", "使用場所の住所"],
  ["phone", "電話"], ["denki_customer_no", "電灯のお客様番号"], ["denki_supply_point", "電灯の供給地点"],
  ["douryoku_customer_no", "動力のお客様番号"], ["douryoku_supply_point", "動力の供給地点"],
  ["gas_customer_no", "ガスのお客様番号"], ["gas_supply_point", "ガスの供給地点"],
] as const;

export type DetailField = (typeof DETAIL_ORDER_FIELDS | typeof DETAIL_CUSTOMER_FIELDS)[number][0];
export type CaseDetail = Record<DetailField | "postal_code" | "note", string | number | null>;
export type CasePhoto = { url: string; filename: string; jpeg: boolean };

const RETRY_LATER = "時間をおいてもう一度お試しください。続くときは管理者へお問い合わせください。";
export const CASE_LIST_ERROR = `関電の案件一覧を読み込めませんでした。${RETRY_LATER}`;
export const CASE_DETAIL_ERROR = `案件の詳細を読み込めませんでした。${RETRY_LATER}`;
export const CASE_PHOTO_ERROR = `写メを読み込めませんでした。${RETRY_LATER}`;
