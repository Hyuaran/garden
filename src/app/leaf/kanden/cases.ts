import type { TableQuery } from "@/app/system/_components/DataTable/DataTable";

export const CASE_TABS = [
  { key: "active", label: "進行中" },
  { key: "completed", label: "完了" },
  { key: "cancelled", label: "キャンセル" },
] as const;

export type CaseTab = typeof CASE_TABS[number]["key"];
export type KandenTab = CaseTab | "forms";

export type CaseRow = {
  id: string;
  kanri_no: string | null;
  kanri_no_raw: string | null;
  ordered_on: string;
  customer_name: string | null;
  acquisition: string | null;
  contract_type: string | null;
  progress: string | null;
  entered_on: string | null;
  mailed_on: string | null;
  invoice_sent_on: string | null;
  sales_name: string | null;
  clerk_name: string | null;
  photo_count: number;
};

export type CaseList = {
  hasOrders: boolean;
  updatedAt: string | null;
  years: number[] | null;
  counts: Record<CaseTab, number> | null;
  rows: CaseRow[];
  total: number;
  page: number;
  withPhotos: number;
  intake?: IntakeRow[];
  intakeTotal?: number;
  intakeUpdatedAt?: string | null;
};

export function caseQuery(tab: KandenTab, search = ""): TableQuery {
  return { page: 1, search, sort: { id: tab === "forms" ? "submitted_at" : "ordered_on", direction: "desc" }, filters: {} };
}

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

export function caseListHref(year: number, tab: KandenTab, search = "") {
  const query = new URLSearchParams({ year: String(year), tab });
  if (search) query.set("q", search);
  return `/leaf/kanden?${query}`;
}

export const DETAIL_ORDER_FIELDS = [
  ["ordered_on", "受注日"], ["entered_on", "エントリー日"], ["specs_on", "諸元回収日"],
  ["jisseki_month", "実績月"], ["application_received_on", "申込書受取日"], ["mailed_on", "郵送日"],
  ["invoice_sent_on", "請求Excel送付日"], ["cancelled_on", "取消日"], ["cancel_reason", "取消・要確認の理由"], ["acquisition", "区分"],
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

export type IntakeRow = Omit<import("@/lib/leaf-kanden/submissions").Submission, "set_id" | "kanri_no_raw" | "note" | "updated_at">;
