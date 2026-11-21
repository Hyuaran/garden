import type { TableQuery } from "@/app/system/_components/DataTable/DataTable";
import { ORDER_STATUSES, type OrderStatus, type StatusInput } from "@/lib/leaf-kanden/status";

import type { PaymentSummary } from "../PaymentDetails";

export const ENTRY_TITLE = "関電 事務入力";
export const ENTRY_SCOPE = "leaf-kanden-entry";
export const ENTRY_TABS = ["受付待ち", ...ORDER_STATUSES] as const;
export type EntryTab = typeof ENTRY_TABS[number];
export const entryQuery: TableQuery = { page: 1, search: "", sort: { id: "date", direction: "desc" }, filters: {} };
export const ENTRY_START = "2026-12-01";
export const dateFields = [
  ["ordered_on", "受注日"], ["specs_on", "諸元回収日"], ["entered_on", "エントリー日"],
  ["application_received_on", "申込書受取日"], ["mailed_on", "郵送日"], ["invoice_sent_on", "請求Excel送付日"], ["cancelled_on", "取消日"],
] as const;
export const choiceFields = [
  ["contract_type", "契約種別"], ["plan", "申込プラン"], ["power_apply", "動力申込"], ["acquisition_method", "獲得手法"],
] as const;
export const serviceFields = [
  ["denki", "電灯"], ["douryoku", "動力"], ["gas", "ガス"],
] as const;
export const textFields = [
  "kanri_no", "customer_name", "customer_kana", "postal_code", "address", "phone", "acquisition",
  "denki_customer_no", "denki_supply_point", "douryoku_customer_no", "douryoku_supply_point",
  "gas_customer_no", "gas_supply_point", "sales_name", "clerk_name", "note", "jisseki_month",
  ...choiceFields.map(([key]) => key), ...dateFields.map(([key]) => key),
] as const;
export const booleanFields = ["urgent_sw", "has_denki", "has_douryoku", "has_gas", "is_direct"] as const;

export type TextKey = typeof textFields[number];
export type BooleanKey = typeof booleanFields[number];
export type SupplyKey = `${typeof serviceFields[number][0]}_supply_point`;
export type EntryDraft = Record<TextKey, string | null> & Record<BooleanKey, boolean | null> & {
  sw_month: number | null;
};
export type EntryRow = [id: string, number: string | null, name: string | null, date: string | null,
  tab: EntryTab, invoice: string | null];
export type EntryList = {
  rows: EntryRow[];
  total: number;
  page: number;
  counts: Partial<Record<EntryTab, number>> | null;
  updatedAt: string | null;
  options: (Record<typeof choiceFields[number][0], string[] | null> & { reason?: string[] }) | null;
};
export type EntryRecord = EntryDraft & StatusInput & {
  id: string;
  submission_id: string | null;
  garden_updated_at: string | null;
  imported_at: string | null;
  flow_updated_at: string | null;
  leaf_kanden_payments: PaymentSummary[];
  hold_reason: string | null;
  return_reason: string | null;
};
export type EntryTarget = { id: string; intake: boolean };
export type SaveMode = "save" | "entry" | "hold" | "return" | "resume";
export type EntryPhoto = import("../cases").CasePhoto & { category: string };
export type EntryDetail = {
  draft: EntryDraft;
  status: OrderStatus;
  version: string | null;
  reason: string | null;
  photos: EntryPhoto[];
  payments: PaymentSummary[];
  paidOn: string | null;
  refundedOn: string | null;
  history: EntryHistory[];
  duplicates: Record<string, string[]>;
  photoError?: string;
};

export type EntryHistory = { id: number; changed_at: string; changed_by: string; field: string; old_value: unknown; new_value: unknown };
