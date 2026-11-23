import { pdKey } from "./sales-form";

export const ACQUISITIONS = ["奪還", "囲込"] as const;
export const PRODUCTS = [
  { key: "denki", label: "電灯", field: "has_denki" },
  { key: "douryoku", label: "動力", field: "has_douryoku" },
  { key: "gas", label: "ガス", field: "has_gas" },
] as const;
export const PHOTO_TYPES = [...PRODUCTS, { key: "specs", label: "諸元" }, { key: "receipt", label: "受領" }] as const;
export type PhotoKind = typeof PHOTO_TYPES[number]["key"];
export type PhotoSlot = { kind: PhotoKind; index: number };
export const MAX_PHOTOS = 30;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const PHOTO_BUCKET = "leaf-kanden-photos";
export const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export type FormInput = {
  acquisition: string; kanri_no_raw: string; customer_name: string;
  has_denki: boolean; has_douryoku: boolean; has_gas: boolean;
  urgent_sw: boolean; sw_month: number | null; note: string;
  customer?: CustomerFields;
};
export type CustomerFields = {
  kana: string; address: string; phone: string; contract: string;
  number: string; supply: string; outside: boolean; listName?: string;
};
export const EMPTY_CUSTOMER: CustomerFields = {
  kana: "", address: "", phone: "", contract: "", number: "", supply: "", outside: false,
};
export type ListCustomer = CustomerFields & { name: string; listName: string };
export type SalesProfile = {
  kana: string | null; hireDate: string | null; email: string | null;
  sent: number; completed: number; awaiting: number; urgent: number;
};
export type Submission = Omit<FormInput, "kanri_no_raw"> & {
  id: string; set_id: string; kanri_no: string | null; kanri_no_raw: string | null; employee_name: string;
  specs_status: "あり" | "諸元待ち"; submitted_at: string; updated_at: string; photo_count: number;
  order_status?: string;
};
export const EMPTY_FORM: FormInput = {
  acquisition: "", kanri_no_raw: "", customer_name: "",
  has_denki: false, has_douryoku: false, has_gas: false,
  urgent_sw: false, sw_month: null, note: "",
};

type ProductFlags = Pick<FormInput, typeof PRODUCTS[number]["field"]>;
export const acquisitionLabel = (row: ProductFlags) => PRODUCTS.filter(p => row[p.field]).map(p => p.label).join("・");
export const urgentLabel = (row: Pick<FormInput, "urgent_sw" | "sw_month">) => row.urgent_sw ? `あり（希望月 ${row.sw_month}月）` : "なし";
export const dateInJapan = (date: Date) => new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
}).format(date);

export function validSlot(slot: PhotoSlot) {
  return Boolean(slot && PHOTO_TYPES.some(type => type.key === slot.kind) &&
    Number.isInteger(slot.index) && slot.index >= 1 && slot.index <= 2_147_483_647);
}

export function submissionError(input: FormInput, slots: PhotoSlot[]) {
  if (!input || !ACQUISITIONS.some(value => value === input.acquisition)) return "区分を選んでください。";
  if (typeof input.kanri_no_raw !== "string" || input.kanri_no_raw.length > 50 ||
      !pdKey(input.kanri_no_raw)) return "PD番号を確認してください。";
  if (typeof input.customer_name !== "string" || !input.customer_name.trim() || input.customer_name.length > 120) {
    return "お客様名を入力してください（120文字まで）。";
  }
  if (PRODUCTS.some(p => typeof input[p.field] !== "boolean") || !acquisitionLabel(input)) {
    return "電灯・動力・ガスのいずれかの写メを添付してください。";
  }
  if (typeof input.urgent_sw !== "boolean" || (input.urgent_sw &&
      (!Number.isInteger(input.sw_month) || input.sw_month! < 1 || input.sw_month! > 12))) return "希望月を1〜12月から選んでください。";
  if (typeof input.note !== "string" || input.note.length > 2000) return "メモは2000文字までです。";
  const customer = input.customer;
  if (customer !== undefined) {
    if (!customer || typeof customer.outside !== "boolean" ||
        ([customer.kana, customer.address, customer.phone, customer.contract]).some(
          value => typeof value !== "string" || value.length > 500,
        ) || (customer.listName !== undefined && (typeof customer.listName !== "string" || customer.listName.length > 500))) {
      return "顧客情報を確認してください。";
    }
    if (typeof customer.number !== "string" || !/^(?:[0-9]{14})?$/.test(customer.number) ||
        (customer.outside && !customer.number)) return "お客様番号を14桁で入力してください。";
    if (typeof customer.supply !== "string" || !/^(?:[0-9]{22})?$/.test(customer.supply)) {
      return "供給地点番号を22桁で入力してください。";
    }
  }
  const missing = PRODUCTS.find(p => input[p.field] && !slots.some(slot => slot.kind === p.key));
  return missing ? `${missing.label}の写メを添付してください。` : "";
}
